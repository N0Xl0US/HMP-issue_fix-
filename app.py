from flask import Flask, request, jsonify
import mysql.connector
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for local testing

# MySQL Database Configuration
db = mysql.connector.connect(
    host="localhost",
    user="root",        # Replace with your MySQL username
    password="Yash@1/3",    # Replace with your MySQL password
    database="hmp"     # Replace with your database name
)

# Route to handle signup data submission
@app.route('/signup', methods=['POST'])
def signup():
    try:
        # Receive JSON data from frontend
        data = request.json
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')

        # Validate input
        if not name or not email or not password:
            return jsonify({'message': 'All fields are required!', 'status': 'error'}), 400

        # Insert data into the database
        cursor = db.cursor()
        query = "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)"
        cursor.execute(query, (name, email, password))
        db.commit()

        return jsonify({'message': 'User registered successfully!', 'status': 'success'}), 201

    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}', 'status': 'error'}), 500


if __name__ == '__main__':
    app.run(debug=True)
