from config import Config
import mysql.connector
from datetime import datetime, timedelta
from contextlib import contextmanager
import logging


class DatabaseConnectionError(Exception):
    """
    Exception raised for errors occurring while connecting to the database.

    Attributes:
        message (str): Explanation of the error.
    """

    def __init__(self, message="Failed to connect to the database"):
        self.message = message
        super().__init__(self.message)


def get_db_connection():
    try:
        db = mysql.connector.connect(
            host=Config.DB_HOST,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME
        )
        return db
    except mysql.connector.Error as err:
        print(f"Database connection failed: {err}")
        return None


def close_db_connection(db):
    try:
        if db:
            db.close()
    except mysql.connector.Error as err:
        raise DatabaseConnectionError(f"Failed to close database connection: {err}")


def get_meal_data(meal_name):
    try:
        db = get_db_connection()
        if db:
            cursor = db.cursor(dictionary=True)
            query = """
                SELECT calories, carbs, proteins, fats, sugar, sodium 
                FROM meals WHERE meal_name = %s
            """
            cursor.execute(query, (meal_name,))
            return cursor.fetchone()
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
    finally:
        if db:
            db.close()
    return None


def add_meal_to_tracking(user_id, meal_id, meal_type, quantity, feedback):
    try:
        connection = get_db_connection()  # Get the DB connection
        cursor = connection.cursor()

        query = """
            INSERT INTO meal_tracking (user_id, meal_id, tracking_date, meal_type, quantity, feedback, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """
        cursor.execute(query, (user_id, meal_id, datetime.now(), meal_type, quantity, feedback))
        connection.commit()  # Commit the transaction to the database
        cursor.close()  # Close the cursor
        connection.close()  # Close the connection
        return {"success": True, "message": "Meal added to tracking"}
    except Exception as e:
        print(f"Error: {e}")
        return {"success": False, "message": "Error adding meal to tracking"}


def get_meal_tracking_stats(user_id):
    connection = get_db_connection()
    if connection is None:
        return {}

    cursor = connection.cursor()

    query = """
    SELECT
        mt.meal_id,
        mt.total_quantity,
        m.calories,
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

    if not meals:
        print("No meals found for user_id:", user_id)  # Debug log
        return {}

    stats = {}
    for meal in meals:
        print("Meal Data:", meal)  # Debug log
        meal_data = {
            'meal_id': meal[0],
            'total_quantity': meal[1] or 0,
            'calories': meal[2] or 0,
            'proteins': meal[3] or 0,
            'carbs': meal[4] or 0,
            'fats': meal[5] or 0,
            'sugar': meal[6] or 0
        }
        stats[meal[0]] = meal_data

    cursor.close()
    connection.close()
    return stats


def record_sleep(user_id, sleep_duration, sleep_quality):
    try:
        db = get_db_connection()
        if db:
            cursor = db.cursor()
            insert_query = """
                INSERT INTO user_sleep (user_id, sleep_duration, sleep_quality, date)
                VALUES (%s, %s, %s, %s)
            """
            current_date = datetime.now().date()
            cursor.execute(insert_query, (user_id, sleep_duration, sleep_quality, current_date))
            db.commit()

            # Retrieve the latest sleep data
            sleep_query = """
                SELECT sleep_duration, sleep_quality, date
                FROM user_sleep
                WHERE user_id = %s
                ORDER BY date DESC LIMIT 1
            """
            cursor.execute(sleep_query, (user_id,))
            return cursor.fetchone()
    except mysql.connector.Error as err:
        print(f"Error recording sleep data: {err}")
    finally:
        if db:
            db.close()
    return {}


def get_health_stats(user_id, period='daily'):
    db = get_db_connection()
    if not db:
        return {"error": "Database connection failed"}

    cursor = db.cursor(dictionary=True)
    
    try:
        if period == 'weekly':
            # Get last 7 days of data
            query = """
                SELECT 
                    DATE(tracked_at) as date,
                    SUM(calories) as total_calories,
                    AVG(sleep_duration) as avg_sleep,
                    AVG(sleep_quality) as avg_sleep_quality
                FROM health_tracking
                WHERE user_id = %s 
                AND tracked_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY DATE(tracked_at)
                ORDER BY date
            """
        else:
            # Get today's data
            query = """
                SELECT 
                    DATE(tracked_at) as date,
                    SUM(calories) as total_calories,
                    AVG(sleep_duration) as avg_sleep,
                    AVG(sleep_quality) as avg_sleep_quality
                FROM health_tracking
                WHERE user_id = %s 
                AND DATE(tracked_at) = CURDATE()
                GROUP BY DATE(tracked_at)
            """
            
        cursor.execute(query, (user_id,))
        results = cursor.fetchall()
        
        return {
            "success": True,
            "data": results
        }
        
    except Exception as e:
        return {"error": str(e)}
    finally:
        cursor.close()
        close_db_connection(db)


def get_meal_data_by_id(meal_id):
    connection = None
    try:
        connection = get_db_connection()
        if not connection:
            return None
            
        cursor = connection.cursor(dictionary=True)
        query = """
            SELECT meal_name, calories, sugar, carbs, proteins, fats
            FROM meals
            WHERE meal_id = %s
        """
        cursor.execute(query, (meal_id,))
        meal_data = cursor.fetchone()
        cursor.close()
        
        return meal_data and {
            "meal_name": meal_data['meal_name'],
            "calories": meal_data['calories'],
            "sugar": meal_data['sugar'],
            "carbs": meal_data['carbs'],
            "proteins": meal_data['proteins'],
            "fats": meal_data['fats']
        }
    except Exception as e:
        print(f"Error fetching meal data: {e}")
        return None
    finally:
        if connection:
            connection.close()