# Healthy Meal Planner

A web application designed to help individuals with chronic diseases plan healthy meals. Built using HTML, CSS, JavaScript, Python, and MySQL.

---

## Features

- **User Authentication**: 
  - Sign Up with email verification.
  - Forgot Password flow with OTP verification.
  - Profile management (update name, email, and password).

- **Personalized Dashboard**: 
  - Displays a welcome screen with user-specific information.
  - Profile icon for easy access to update profile information.

- **Meal Planning**: 
  - Provides healthy meal options tailored for chronic diseases.
  - Supports custom meal suggestions based on user preferences.

---

## Project Structure

### **Frontend**
- **HTML/CSS/JavaScript**:
  - Responsive design.
  - Interactive forms for authentication and password reset.
  - Smooth animations for form transitions.

### **Backend**
- **Python (Flask)**:
  - Handles user authentication.
  - Processes meal planning logic.
  - Manages email and OTP verifications.

- **MySQL**:
  - Stores user data, meal plans, and health-related data.

---

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yshrjpatil/HMP.git
   cd HMP
   ```

2. **Set up Python virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure MySQL**
   - Install MySQL if not already installed
   - Create a new database:
     ```sql
     CREATE DATABASE healthy_meal_planner;
     ```
   - Copy `.env.example` to `.env` and update database credentials

4. **Initialize the application**
   ```bash
   flask db init
   flask db migrate
   flask db upgrade
   ```

5. **Run the application**
   ```bash
   flask run
   ```
   Visit `http://localhost:5000` in your browser

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

SECRET_KEY=your_secret_key
SESSION_TYPE=filesystem
DB_HOST=localhost
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=healthy_meal_planner
EMAIL_SENDER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587

> **Note**: Replace the placeholder values with your actual credentials. Never commit the real `.env` file with sensitive information to version control.

> **Important**: For Gmail, make sure to use an App Password instead of your regular account password. You can generate one in your Google Account settings under Security > 2-Step Verification > App passwords.
