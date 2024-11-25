from flask import Flask, render_template, request, redirect, session, flash, jsonify
import mysql.connector
import os
from flask_bcrypt import Bcrypt
import smtplib
import random
import time
from logger import log_action

app = Flask(__name__)
bcrypt = Bcrypt(app)
app.secret_key = os.urandom(24)

# Temporary in-memory storage for verification codes
verification_codes = {}

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="AutoSuggestion0",
    database="healthy_meal_planner"
)
cursor = db.cursor(dictionary=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()  # Get the data as JSON
    name = data['name']
    email = data['email']
    password = bcrypt.generate_password_hash(data['password']).decode('utf-8')  # Hash the password

    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({"success": False, "message": "Email already exists."})

    verification_code = random.randint(100000, 999999)

    try:
        sender_email = "hmp.help@gmail.com"
        sender_password = "rscw eewr atra jzro"
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        message = f"Subject: Verify Your Email\n\nYour verification code is: {verification_code}"
        server.sendmail(sender_email, email, message)
        server.quit()
    except Exception as e:
        return jsonify({"success": False, "message": "Failed to send verification email. Please try again later."})

    # Store verification code temporarily for later verification
    verification_codes[email] = {"code": verification_code, "timestamp": time.time()}

    # Save user to DB (without verification yet)
    cursor.execute("INSERT INTO users (full_name, email, password, email_verified) VALUES (%s, %s, %s, %s)",
                   (name, email, password, False))
    db.commit()

    return jsonify({"success": True, "message": "Verification email sent."})


@app.route('/verify-email', methods=['POST'])
def verify_email():
    data = request.get_json()
    email = data.get('email')
    verification_code = data.get('code')

    if not email or not verification_code:
        return jsonify({"success": False, "message": "Email and code are required."}), 400

    # Check if the verification code matches the stored code for the email
    stored_code_info = verification_codes.get(email)
    if not stored_code_info or stored_code_info["code"] != int(verification_code):
        return jsonify({"success": False, "message": "Invalid verification code."})

    # Check if the code expired (e.g., expire after 10 minutes)
    if time.time() - stored_code_info["timestamp"] > 600:  # 10 minutes
        del verification_codes[email]  # Clear expired code
        return jsonify({"success": False, "message": "Verification code expired."})

    # Update the user's verification status
    cursor.execute("UPDATE users SET email_verified = TRUE WHERE email = %s", (email,))
    db.commit()

    # Clear the verification code as it's no longer needed
    del verification_codes[email]

    return jsonify({"success": True, "message": "Email verified successfully. You can now log in."})


@app.route('/login', methods=['POST'])
def login():
    email = request.form['email']
    password = request.form['password']

    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if not user or not bcrypt.check_password_hash(user["password"], password):
        flash("Invalid email or password.", "danger")
        return redirect('/')

    if not user["email_verified"]:
        flash("Your email is not verified. Please check your email for the verification code.", "warning")
        return redirect('/')

    session['user_id'] = user['user_id']
    session['name'] = user['full_name']

    log_action(user_id=user['user_id'], action_type="LOGIN", description="User logged in.")

    return redirect('/dashboard')


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        flash("Please log in to access this page.", "danger")
        return redirect('/')

    # Retrieve user's name from session
    user_name = session.get('name')

    # Render the dashboard template and pass the user's name
    return render_template('dashboard.html', name=user_name)


@app.route('/logout')
def logout():
    if 'user_id' in session:
        log_action(user_id=session['user_id'], action_type="LOGOUT", description="User logged out.")
        session.clear()

    flash("You have been logged out.", "success")
    return redirect('/')


@app.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json()
    email = data.get('email')

    # Check if the email exists in the database
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if not user:
        return jsonify({"success": False, "message": "Email not found."})

    # Generate OTP and send via email
    otp = random.randint(100000, 999999)
    # Store OTP temporarily with a timestamp
    verification_codes[email] = {"code": otp, "timestamp": time.time()}

    # Send OTP via email
    try:
        sender_email = "hmp.help@gmail.com"
        sender_password = "rscw eewr atra jzro"
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        message = f"Subject: Your OTP Code\n\nYour OTP code is: {otp}"
        server.sendmail(sender_email, email, message)
        server.quit()

        return jsonify({"success": True, "message": "OTP sent to your email."})
    except Exception as e:
        return jsonify({"success": False, "message": "Failed to send OTP."})


@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email')
    otp = data.get('otp')

    # Check if OTP matches
    stored_otp_info = verification_codes.get(email)
    if not stored_otp_info or stored_otp_info["code"] != int(otp):
        return jsonify({"success": False, "message": "Invalid OTP."})

    # Check if the OTP expired (e.g., expire after 5 minutes)
    if time.time() - stored_otp_info["timestamp"] > 300:  # 5 minutes
        del verification_codes[email]  # Clear expired OTP
        return jsonify({"success": False, "message": "OTP expired."})

    # Clear OTP entry after successful verification
    del verification_codes[email]

    return jsonify({"success": True, "message": "OTP verified."})


@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email')
    new_password = data.get('newPassword')

    # Hash the new password
    hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')

    # Update the password in the database
    cursor.execute("UPDATE users SET password = %s WHERE email = %s", (hashed_password, email))
    db.commit()

    # Clear the OTP entry
    if email in verification_codes:
        del verification_codes[email]

    return jsonify({"success": True, "message": "Password reset successful."})


if __name__ == "__main__":
    app.run(debug=True)