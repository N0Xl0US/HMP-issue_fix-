import os
import random
import time
import smtplib
from flask import Flask, render_template, request, redirect, session, flash, jsonify, url_for
from flask_bcrypt import Bcrypt
from flask_session import Session
import mysql.connector
from werkzeug.utils import secure_filename

from hmp_helper import get_db_connection, close_db_connection, add_meal_to_tracking, get_health_stats
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

bcrypt = Bcrypt(app)
app.config["SESSION_FILE_DIR"] = "./flask_session_cache"
Session(app)

verification_codes = {}


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
                "user_data": {"name": name, "email": email, "password": password}
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
                "INSERT INTO users (full_name, email, password, email_verified) VALUES (%s, %s, %s, TRUE)",
                (user_data["name"], user_data["email"], user_data["password"])
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
        data = request.get_json()  # Get the data from the request
        meal_id = data.get('meal_id')
        meal_type = data.get('meal_type')
        feedback = data.get('feedback')

        # Assuming user_id is stored in session after login
        user_id = session.get('user_id')  # Retrieve user_id from session

        if not meal_id or not meal_type or not feedback or not user_id:
            return jsonify({"success": False, "message": "Missing required fields or user is not logged in"})

        # Add meal to tracking
        result = add_meal_to_tracking(user_id, meal_id, meal_type, quantity=1, feedback=feedback)

        return jsonify(result)

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


if __name__ == "__main__":
    app.run(debug=True)
