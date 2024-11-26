from flask import Flask, render_template, request, redirect, session, flash, jsonify, url_for
from flask_bcrypt import Bcrypt
from flask_session import Session
from config import Config
import mysql.connector
import random
import time
from datetime import datetime, timedelta
import smtplib

app = Flask(__name__)
app.config.from_object(Config)

bcrypt = Bcrypt(app)
app.config["SESSION_FILE_DIR"] = "./flask_session_cache"
Session(app)

verification_codes = {}

# Database connection
db = mysql.connector.connect(
    host=Config.DB_HOST,
    user=Config.DB_USER,
    password=Config.DB_PASSWORD,
    database=Config.DB_NAME
)
cursor = db.cursor(dictionary=True)


# Helper functions
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

# Home route (Landing page)
@app.route('/')
def home():
    return render_template('index.html')


# About route (Information about the app or service)
@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/login_signup')
def login_signup():
    return render_template('login_signup.html')


# Dashboard route (User profile and other data)
@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login_signup'))  # Redirect to login if not logged in
    return render_template('dashboard.html', user_name=session['name'])


# Profile route (View and update user profile)
@app.route('/profile', methods=['GET', 'POST'])
def profile():
    if 'user_id' not in session:
        return redirect(url_for('login_signup'))  # Redirect to login if not logged in

    if request.method == 'POST':
        # Update profile logic (e.g., change email or password)
        new_name = request.form['name']
        new_email = request.form['email']
        new_password = request.form['password']

        # Hash the new password if provided
        if new_password:
            new_password = bcrypt.generate_password_hash(new_password).decode('utf-8')

        cursor.execute("""
            UPDATE users
            SET full_name = %s, email = %s, password = %s
            WHERE user_id = %s
        """, (new_name, new_email, new_password, session['user_id']))
        db.commit()

        session['name'] = new_name  # Update session name

        flash("Profile updated successfully!", "success")
        return redirect(url_for('profile'))

    # Get current user details
    cursor.execute("SELECT full_name, email FROM users WHERE user_id = %s", (session['user_id'],))
    user = cursor.fetchone()
    return render_template('profile.html', user=user)


# Signup route (Create a new account)
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    name = data['name']
    email = data['email']
    password = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({"success": False, "message": "Email already exists."})

    verification_code = generate_otp()
    if send_email("Verify Your Email", email, f"Your verification code is: {verification_code}"):
        verification_codes[email] = {
            "code": verification_code,
            "timestamp": time.time(),
            "user_data": {"name": name, "email": email, "password": password}
        }
        return jsonify({"success": True, "message": "Verification email sent."})
    return jsonify({"success": False, "message": "Failed to send verification email."})


# Verify email route (Handle email verification)
@app.route('/verify-email', methods=['POST'])
def verify_email():
    data = request.get_json()
    email = data['email']
    code = int(data['code'])

    stored_code_info = verification_codes.get(email)
    if not stored_code_info or stored_code_info["code"] != code or time.time() - stored_code_info["timestamp"] > 600:
        return jsonify({"success": False, "message": "Invalid or expired verification code."})

    user_data = stored_code_info["user_data"]
    cursor.execute(
        "INSERT INTO users (full_name, email, password, email_verified) VALUES (%s, %s, %s, TRUE)",
        (user_data["name"], user_data["email"], user_data["password"])
    )
    db.commit()
    del verification_codes[email]

    return jsonify({"success": True, "message": "Email verified successfully."})


# Login route (Authenticate users)
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data['email']
    password = data['password']

    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if not user or not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"success": False, "message": "Invalid email or password."})

    if not user["email_verified"]:
        return jsonify({"success": False, "message": "Please verify your email before logging in."})

    session['user_id'] = user['user_id']
    session['name'] = user['full_name']
    return jsonify({"success": True, "message": "Login successful."})


# Logout route (Clear session and log out the user)
@app.route('/logout')
def logout():
    session.clear()
    session.modified = True
    response = redirect(url_for('home'))
    response.set_cookie('session', '', expires=datetime(1970, 1, 1))
    return response


# Send OTP for password reset
@app.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json()
    email = data['email']

    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    if not cursor.fetchone():
        return jsonify({"success": False, "message": "Email not found."})

    otp = generate_otp()
    verification_codes[email] = {"code": otp, "timestamp": time.time()}

    if send_email("Your OTP Code", email, f"Your OTP code is: {otp}"):
        return jsonify({"success": True, "message": "OTP sent to your email."})
    return jsonify({"success": False, "message": "Failed to send OTP email."})


# Reset password route (Allow user to reset password using OTP)
@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data['email']
    otp = int(data['otp'])
    new_password = bcrypt.generate_password_hash(data['newPassword']).decode('utf-8')

    stored_code_info = verification_codes.get(email)
    if not stored_code_info or stored_code_info["code"] != otp or time.time() - stored_code_info["timestamp"] > 300:
        return jsonify({"success": False, "message": "Invalid or expired OTP."})

    cursor.execute("UPDATE users SET password = %s WHERE email = %s", (new_password, email))
    db.commit()
    del verification_codes[email]

    return jsonify({"success": True, "message": "Password reset successful."})


# Error handler for 404 (Page Not Found)
@app.errorhandler(404)
def page_not_found(e):
    logged_in = 'user_id' in session
    return render_template('404.html', logged_in=logged_in), 404


if __name__ == "__main__":
    app.run(debug=True)