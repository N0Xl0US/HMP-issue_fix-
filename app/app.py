import os
import random
import time
import smtplib
from flask import Flask, render_template, request, redirect, session, flash, jsonify, url_for, Blueprint
from flask_bcrypt import Bcrypt
from flask_session import Session
import mysql.connector
from werkzeug.utils import secure_filename
from typing import List, Dict
from datetime import datetime, timedelta
from functools import wraps

from hmp_helper import get_db_connection, close_db_connection, add_meal_to_tracking, get_health_stats
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

bcrypt = Bcrypt(app)
app.config["SESSION_FILE_DIR"] = "./flask_session_cache"
Session(app)

verification_codes = {}

class MealPlanner:
    def __init__(self, db_connection):
        self.db = db_connection

    def get_suitable_recipes(self, meal_type: str, conditions: List[str], 
                           calorie_target: int) -> List[Dict]:
        """Get recipes suitable for given conditions and calorie target"""
        condition_filter = ""
        if conditions:
            condition_filter = "AND (" + " OR ".join([
                f"suitable_conditions LIKE '%{cond}%'" 
                for cond in conditions
            ]) + ")"
            
        query = f"""
            SELECT * FROM recipes 
            WHERE meal_type = %s 
            {condition_filter}
            AND calories <= %s
            ORDER BY RAND()
            LIMIT 5
        """
        
        cursor = self.db.cursor(dictionary=True)
        cursor.execute(query, (meal_type, calorie_target * 0.4))
        return cursor.fetchall()

    def generate_daily_plan(self, user_id: int, date: datetime) -> Dict:
        """Generate a daily meal plan for user"""
        # Get user details and conditions
        cursor = self.db.cursor(dictionary=True)
        cursor.execute("""
            SELECT chronic_conditions, daily_calories 
            FROM users WHERE id = %s
        """, (user_id,))
        user_data = cursor.fetchone()
        
        conditions = user_data['chronic_conditions'].split(',')
        daily_calories = user_data['daily_calories']

        # Generate meal plan
        breakfast = self.get_suitable_recipes('breakfast', conditions, 
                                           daily_calories * 0.25)
        lunch = self.get_suitable_recipes('lunch', conditions, 
                                        daily_calories * 0.35)
        dinner = self.get_suitable_recipes('dinner', conditions, 
                                         daily_calories * 0.35)
        snacks = self.get_suitable_recipes('snack', conditions, 
                                         daily_calories * 0.05)

        # Save to database
        cursor.execute("""
            INSERT INTO meal_plans 
            (user_id, plan_date, breakfast_id, lunch_id, dinner_id, snacks_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            user_id, date,
            breakfast[0]['id'], lunch[0]['id'],
            dinner[0]['id'], snacks[0]['id']
        ))
        self.db.commit()

        return {
            'breakfast': breakfast[0],
            'lunch': lunch[0],
            'dinner': dinner[0],
            'snacks': snacks[0],
            'total_calories': sum(m['calories'] for m in 
                                [breakfast[0], lunch[0], dinner[0], snacks[0]])
        }

    def customize_meal_plan(self, plan_id: int, meal_updates: Dict) -> Dict:
        """Allow users to customize their meal plan"""
        update_fields = []
        update_values = []
        
        for meal_type, recipe_id in meal_updates.items():
            field_name = f"{meal_type}_id"
            update_fields.append(f"{field_name} = %s")
            update_values.append(recipe_id)
            
        update_values.append(plan_id)
        
        cursor = self.db.cursor()
        cursor.execute(f"""
            UPDATE meal_plans 
            SET {', '.join(update_fields)}, is_custom = TRUE
            WHERE id = %s
        """, tuple(update_values))
        
        self.db.commit()
        
        return self.get_meal_plan(plan_id)

    def get_meal_plan(self, plan_id: int) -> Dict:
        """Get a specific meal plan with recipe details"""
        cursor = self.db.cursor(dictionary=True)
        cursor.execute("""
            SELECT mp.*, 
                   b.name as breakfast_name, b.calories as breakfast_calories,
                   l.name as lunch_name, l.calories as lunch_calories,
                   d.name as dinner_name, d.calories as dinner_calories,
                   s.name as snack_name, s.calories as snack_calories
            FROM meal_plans mp
            JOIN recipes b ON mp.breakfast_id = b.id
            JOIN recipes l ON mp.lunch_id = l.id
            JOIN recipes d ON mp.dinner_id = d.id
            JOIN recipes s ON mp.snacks_id = s.id
            WHERE mp.id = %s
        """, (plan_id,))
        
        return cursor.fetchone()

meal_plans = Blueprint('meal_plans', __name__)
meal_planner = MealPlanner(mysql.connector)


def generate_otp():
    return random.randint(100000, 999999)


def send_email(subject, recipient, message_body):
    try:
        with smtplib.SMTP(Config.SMTP_SERVER, Config.SMTP_PORT) as server:
            server.starttls()
            server.login(Config.EMAIL_SENDER, Config.EMAIL_PASSWORD)
            message = f"Subject: {subject}\n\n{message_body}"
            server.sendmail(Config.EMAIL_SENDER, recipient, message)
        return True
    except Exception as e:
        app.logger.error(f"Failed to send email: {e}")
        return False


# Routes

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/login_signup')
def login_signup():
    return render_template('login_signup.html')


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login_signup'))
    return render_template('dashboard.html', user_name=session['name'], user_id=session['user_id'])


UPLOAD_FOLDER = 'static/uploads/profile_pictures'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/profile', methods=['GET', 'POST'])
def profile():
    if 'user_id' not in session:
        return redirect(url_for('login_signup'))

    if request.method == 'POST':
        new_name = request.form['name']
        new_email = request.form['email']
        new_password = request.form['password']
        profile_picture = request.files.get('profile_picture')

        if new_password:
            new_password = bcrypt.generate_password_hash(new_password).decode('utf-8')

        profile_picture_path = session.get('profile_picture')
        if profile_picture:
            filename = secure_filename(f"user_{session['user_id']}_{profile_picture.filename}")
            profile_picture_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            profile_picture.save(profile_picture_path)

        db = get_db_connection()
        if db:
            cursor = db.cursor(dictionary=True)
            try:
                cursor.execute("""
                    UPDATE users
                    SET full_name = %s, email = %s, password = %s, profile_picture = %s
                    WHERE user_id = %s
                """, (new_name, new_email, new_password, profile_picture_path, session['user_id']))
                db.commit()

                session['name'] = new_name
                session['profile_picture'] = profile_picture_path

                flash("Profile updated successfully!", "success")
                return redirect(url_for('profile'))
            except mysql.connector.Error as err:
                flash(f"Error updating profile: {err}", "danger")
            finally:
                close_db_connection(db)

    db = get_db_connection()
    if db:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT full_name, email, profile_picture FROM users WHERE user_id = %s", (session['user_id'],))
        user = cursor.fetchone()
        close_db_connection(db)

    return render_template('profile.html', user=user)


@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    name = data['name']
    email = data['email']
    password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    chronic_conditions = data.get('chronic_conditions', '')  # New field

    db = get_db_connection()
    if db:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            close_db_connection(db)
            return jsonify({"success": False, "message": "Email already exists."})

        verification_code = generate_otp()
        if send_email("Verify Your Email", email, f"Your verification code is: {verification_code}"):
            verification_codes[email] = {
                "code": verification_code,
                "timestamp": time.time(),
                "user_data": {
                    "name": name,
                    "email": email,
                    "password": password,
                    "chronic_conditions": chronic_conditions
                }
            }
            close_db_connection(db)
            return jsonify({"success": True, "message": "Verification email sent."})
        close_db_connection(db)
    return jsonify({"success": False, "message": "Failed to send verification email."})


@app.route('/verify-email', methods=['POST'])
def verify_email():
    data = request.get_json()
    email = data['email']
    code = int(data['code'])

    stored_code_info = verification_codes.get(email)
    if not stored_code_info or stored_code_info["code"] != code or time.time() - stored_code_info["timestamp"] > 600:
        return jsonify({"success": False, "message": "Invalid or expired verification code."})

    user_data = stored_code_info["user_data"]
    db = get_db_connection()
    if db:
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute(
                "INSERT INTO users (full_name, email, password, email_verified, chronic_conditions) VALUES (%s, %s, %s, TRUE, %s)",
                (user_data["name"], user_data["email"], user_data["password"], user_data["chronic_conditions"])
            )
            db.commit()
            del verification_codes[email]
            close_db_connection(db)
            return jsonify({"success": True, "message": "Email verified successfully."})
        except mysql.connector.Error as err:
            close_db_connection(db)
            return jsonify({"success": False, "message": f"Error verifying email: {err}"})
    return jsonify({"success": False, "message": "Database connection failed."})


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data['email']
    password = data['password']

    db = get_db_connection()
    if db:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user or not bcrypt.check_password_hash(user["password"], password):
            close_db_connection(db)
            return jsonify({"success": False, "message": "Invalid email or password."})

        if not user["email_verified"]:
            close_db_connection(db)
            return jsonify({"success": False, "message": "Please verify your email before logging in."})

        session['user_id'] = user['user_id']
        session['name'] = user['full_name']
        session['profile_picture'] = user['profile_picture'] or url_for('static', filename='images/default_profile.jpg')
        close_db_connection(db)
        return jsonify({"success": True, "message": "Login successful."})
    return jsonify({"success": False, "message": "Database connection failed."})


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully."})


@app.route('/add_meal', methods=['POST'])
def add_meal():
    try:
        data = request.get_json()
        meal_id = data.get('meal_id')
        meal_type = data.get('meal_type')
        feedback = data.get('feedback')
        user_id = session.get('user_id')

        if not meal_id or not meal_type or not feedback or not user_id:
            return jsonify({"success": False, "message": "Missing required fields or user is not logged in"})

        # Add meal to tracking
        result = add_meal_to_tracking(user_id, meal_id, meal_type, quantity=1, feedback=feedback)
        
        # Check nutritional limits and generate notifications
        notifications = check_nutritional_limits(user_id)
        
        return jsonify({
            "success": result["success"],
            "message": result["message"],
            "notifications": notifications
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"success": False, "message": "An error occurred while adding the meal"})


def get_meal_tracking_stats(user_id):
    connection = get_db_connection()

    if connection is None:
        return {}

    cursor = connection.cursor()

    # Modified query to include meal_type
    query = """
    SELECT
        mt.meal_id,
        mt.total_quantity,
        m.calories,
        mt.meal_type, -- Assuming meal_type exists in the meals table
        m.proteins,
        m.carbs,
        m.fats,
        m.sugar
    FROM meal_tracking mt
    JOIN meals m ON mt.meal_id = m.meal_id
    WHERE mt.user_id = %s
    """
    cursor.execute(query, (user_id,))
    meals = cursor.fetchall()

    stats = {}
    for meal in meals:
        meal_data = {
            'meal_id': meal[0],
            'total_quantity': meal[1],
            'calories': meal[2],
            'meal_type': meal[3],  # Added meal_type
            'proteins': meal[4],
            'carbs': meal[5],
            'fats': meal[6],
            'sugar': meal[7]
        }
        stats[meal[0]] = meal_data

    cursor.close()
    close_db_connection(connection)
    return stats


@app.route('/get_meals', methods=['GET'])
def get_meals():
    try:
        connection = get_db_connection()  # Ensure this is returning a valid connection
        if connection is None:
            raise Exception("Failed to connect to the database.")

        cursor = connection.cursor()
        cursor.execute("SELECT meal_id, meal_name FROM meals")
        meals = cursor.fetchall()
        cursor.close()
        connection.close()

        if not meals:
            return jsonify({"error": "No meals found"}), 404  # Return an error if no meals are found

        return jsonify([{"meal_id": meal[0], "meal_name": meal[1]} for meal in meals])

    except Exception as e:
        print("Error fetching meals:", e)
        return jsonify({"error": "Failed to fetch meals"}), 500


@app.route('/get_updated_stats', methods=['GET', 'POST'])
def get_updated_stats():
    user_id = session.get('user_id')
    if user_id:
        stats = get_meal_tracking_stats(user_id)
        print(stats)  # Debug print to check the structure

        # Aggregate total calories by meal type
        meal_breakdown = {}
        for meal in stats.values():
            meal_type = meal['meal_type']
            total_calories = float(meal['total_quantity'] or 0) * float(meal['calories'] or 0)
            if meal_type not in meal_breakdown:
                meal_breakdown[meal_type] = 0
            meal_breakdown[meal_type] += total_calories

        response_data = {
            "caloriesConsumed": sum(meal_breakdown.values()),
            "mealBreakdown": meal_breakdown,  # Total calories by meal type
            "sugarLevels": [
                float(meal['total_quantity'] or 0) * float(meal['sugar'] or 0)
                for meal in stats.values()
            ],
            "macronutrientBreakdown": {
                "carbs": sum([
                    float(meal['total_quantity'] or 0) * float(meal['carbs'] or 0)
                    for meal in stats.values()
                ]),
                "proteins": sum([
                    float(meal['total_quantity'] or 0) * float(meal['proteins'] or 0)
                    for meal in stats.values()
                ]),
                "fats": sum([
                    float(meal['total_quantity'] or 0) * float(meal['fats'] or 0)
                    for meal in stats.values()
                ])
            }
        }
        return jsonify(response_data)
    return jsonify({"error": "User not logged in"}), 403


@app.route('/record_sleep', methods=['POST'])
def record_sleep():
    data = request.json
    sleep_duration = data.get('sleepDuration')  # Sleep duration in hours
    sleep_quality = data.get('sleepQuality')  # Sleep quality on a scale of 1-10

    if not sleep_duration or not sleep_quality:
        return jsonify({'error': 'Invalid sleep data'}), 400

    user_id = session['user_id']
    sleep_entry = record_sleep(user_id, sleep_duration, sleep_quality)

    return jsonify(sleep_entry)


@app.route('/health_stats', methods=['GET'])
def health_stats():
    user_id = session['user_id']
    period = request.args.get('period', 'daily')  # default to daily stats
    health_data = get_health_stats(user_id, period)

    return jsonify(health_data)


# Error handler for 404 (Page Not Found)
@app.errorhandler(404)
def page_not_found(e):
    logged_in = 'user_id' in session
    return render_template('404.html', logged_in=logged_in), 404


def check_nutritional_limits(user_id):
    """Check if user is approaching or has exceeded nutritional limits"""
    db = get_db_connection()
    if not db:
        return False

    cursor = db.cursor(dictionary=True)
    
    # Get user's daily limits from user preferences/settings
    cursor.execute("""
        SELECT daily_calorie_limit, daily_sugar_limit, daily_sodium_limit 
        FROM user_preferences 
        WHERE user_id = %s
    """, (user_id,))
    limits = cursor.fetchone()
    
    if not limits:
        close_db_connection(db)
        return False

    # Get today's total intake
    cursor.execute("""
        SELECT 
            SUM(m.calories * mt.total_quantity) as total_calories,
            SUM(m.sugar * mt.total_quantity) as total_sugar,
            SUM(m.sodium * mt.total_quantity) as total_sodium
        FROM meal_tracking mt
        JOIN meals m ON mt.meal_id = m.meal_id
        WHERE mt.user_id = %s 
        AND DATE(mt.tracked_at) = CURDATE()
    """, (user_id,))
    
    totals = cursor.fetchone()
    
    notifications = []
    
    # Check each nutritional value
    for nutrient, total, limit in [
        ('calories', totals['total_calories'], limits['daily_calorie_limit']),
        ('sugar', totals['total_sugar'], limits['daily_sugar_limit']),
        ('sodium', totals['total_sodium'], limits['daily_sodium_limit'])
    ]:
        if total is None:
            continue
            
        # About to exceed (80% of limit)
        if 0.8 * limit <= total < limit:
            suggestions = generate_nutritional_suggestions(nutrient, total, limit, user_id)
            notifications.append({
                'type': 'warning',
                'message': f'You are approaching your daily {nutrient} limit',
                'nutrient': nutrient,
                'current': total,
                'limit': limit,
                'suggestions': suggestions
            })
        # Exceeded
        elif total >= limit:
            suggestions = generate_nutritional_suggestions(nutrient, total, limit, user_id)
            notifications.append({
                'type': 'alert',
                'message': f'You have exceeded your daily {nutrient} limit',
                'nutrient': nutrient,
                'current': total,
                'limit': limit,
                'suggestions': suggestions
            })
    
    # Store notifications in database
    if notifications:
        for notif in notifications:
            cursor.execute("""
                INSERT INTO notifications 
                (user_id, type, message, created_at, is_read, suggestions)
                VALUES (%s, %s, %s, NOW(), FALSE, %s)
            """, (user_id, notif['type'], notif['message'], 
                  ','.join(notif.get('suggestions', []))))
        db.commit()
    
    close_db_connection(db)
    return notifications


@app.route('/get_notifications', methods=['GET'])
def get_notifications():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "User not logged in"})
        
    db = get_db_connection()
    if not db:
        return jsonify({"success": False, "message": "Database connection failed"})
        
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT id, type, message, created_at, is_read 
        FROM notifications 
        WHERE user_id = %s 
        ORDER BY created_at DESC 
        LIMIT 10
    """, (session['user_id'],))
    
    notifications = cursor.fetchall()
    close_db_connection(db)
    
    return jsonify({
        "success": True,
        "notifications": notifications
    })


@app.route('/mark_notification_read', methods=['POST'])
def mark_notification_read():
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "User not logged in"})
        
    notification_id = request.json.get('notification_id')
    if not notification_id:
        return jsonify({"success": False, "message": "Notification ID required"})
        
    db = get_db_connection()
    if not db:
        return jsonify({"success": False, "message": "Database connection failed"})
        
    cursor = db.cursor()
    cursor.execute("""
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE id = %s AND user_id = %s
    """, (notification_id, session['user_id']))
    
    db.commit()
    close_db_connection(db)
    
    return jsonify({"success": True, "message": "Notification marked as read"})


def generate_nutritional_suggestions(nutrient, current_value, limit, user_id):
    """Generate personalized suggestions based on nutritional limits"""
    db = get_db_connection()
    if not db:
        return []
        
    cursor = db.cursor(dictionary=True)
    suggestions = []
    
    if nutrient == 'calories':
        # Get lower calorie alternatives from meals table
        cursor.execute("""
            SELECT m.meal_name, m.calories 
            FROM meals m
            JOIN meal_tracking mt ON m.meal_id = mt.meal_id
            WHERE mt.user_id = %s 
            AND DATE(mt.tracked_at) = CURDATE()
            ORDER BY m.calories ASC
            LIMIT 3
        """, (user_id,))
        alternatives = cursor.fetchall()
        
        suggestions.append("Consider lighter meals for your next meal period")
        if alternatives:
            suggestions.append(f"Try these lower-calorie alternatives: {', '.join([meal['meal_name'] for meal in alternatives])}")
            
    elif nutrient == 'sugar':
        suggestions.append("Reduce sugar intake by avoiding sugary drinks and desserts")
        suggestions.append("Choose fresh fruits instead of processed snacks")
        
        # Get low sugar alternatives
        cursor.execute("""
            SELECT meal_name FROM meals 
            WHERE sugar < 5 
            ORDER BY RAND() 
            LIMIT 2
        """)
        alternatives = cursor.fetchall()
        if alternatives:
            suggestions.append(f"Consider these low-sugar options: {', '.join([meal['meal_name'] for meal in alternatives])}")
            
    elif nutrient == 'sodium':
        suggestions.append("Reduce sodium by avoiding processed and packaged foods")
        suggestions.append("Choose fresh vegetables and lean proteins")
        
        # Get low sodium meals
        cursor.execute("""
            SELECT meal_name FROM meals 
            WHERE sodium < 500 
            ORDER BY RAND() 
            LIMIT 2
        """)
        alternatives = cursor.fetchall()
        if alternatives:
            suggestions.append(f"Try these low-sodium alternatives: {', '.join([meal['meal_name'] for meal in alternatives])}")
    
    close_db_connection(db)
    return suggestions

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login_signup'))
        return f(*args, **kwargs)
    return decorated_function 

@meal_plans.route('/generate_meal_plan', methods=['POST'])
@login_required
def generate_meal_plan():
    try:
        date = datetime.strptime(
            request.json.get('date', datetime.now().strftime('%Y-%m-%d')),
            '%Y-%m-%d'
        )
        
        plan = meal_planner.generate_daily_plan(
            session['user_id'], 
            date
        )
        
        return jsonify({
            'status': 'success',
            'meal_plan': plan
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
       

@meal_plans.route('/customize_meal_plan/<int:plan_id>', methods=['PUT'])
@login_required
def customize_meal_plan(plan_id):
    try:
        updates = request.json
        plan = meal_planner.customize_meal_plan(plan_id, updates)
        
        return jsonify({
            'status': 'success',
            'meal_plan': plan
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
