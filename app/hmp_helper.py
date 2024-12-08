from app import app
from config import Config
import mysql.connector
from datetime import datetime, timedelta


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
        app.logger.error(f"Failed to close database connection: {err}")


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
            INSERT INTO meal_tracking (user_id, meal_id, tracking_date, quantity, feedback, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """
        cursor.execute(query, (user_id, meal_id, datetime.now(), quantity, feedback))
        connection.commit()  # Commit the transaction to the database
        cursor.close()  # Close the cursor
        connection.close()  # Close the connection
        return {"success": True, "message": "Meal added to tracking"}
    except Exception as e:
        print(f"Error: {e}")
        return {"success": False, "message": "Error adding meal to tracking"}


def get_meal_tracking_stats(user_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        query = """
            SELECT meal_id, SUM(quantity) as total_quantity, meal_type
            FROM meal_tracking
            WHERE user_id = %s
            GROUP BY meal_type
        """
        cursor.execute(query, (user_id,))
        result = cursor.fetchall()
        cursor.close()
        return result
    except Exception as e:
        print(f"Error: {e}")
        return {"success": False, "message": "Error fetching meal tracking data"}


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
    try:
        db = get_db_connection()
        if db:
            cursor = db.cursor()

            # Calculate the date range based on the period (daily, weekly, monthly, yearly)
            if period == 'daily':
                start_date = datetime.now().date()
                end_date = start_date
            elif period == 'weekly':
                end_date = datetime.now().date()
                start_date = end_date - timedelta(weeks=1)
            elif period == 'monthly':
                end_date = datetime.now().date()
                start_date = end_date.replace(day=1)
            elif period == 'yearly':
                end_date = datetime.now().date()
                start_date = end_date.replace(month=1, day=1)

            # Retrieve meal stats within the specified period
            stats_query = """
                SELECT SUM(total_calories) AS total_calories,
                       SUM(total_carbs) AS total_carbs,
                       SUM(total_proteins) AS total_proteins,
                       SUM(total_fats) AS total_fats,
                       SUM(total_sugar) AS total_sugar,
                       SUM(total_sodium) AS total_sodium
                FROM user_meal_stats
                WHERE user_id = %s AND date >= %s AND date <= %s
            """
            cursor.execute(stats_query, (user_id, start_date, end_date))
            meal_stats = cursor.fetchone()

            # Retrieve sleep stats within the specified period
            sleep_query = """
                SELECT SUM(sleep_duration) AS total_sleep_duration,
                       AVG(sleep_quality) AS avg_sleep_quality
                FROM user_sleep
                WHERE user_id = %s AND date >= %s AND date <= %s
            """
            cursor.execute(sleep_query, (user_id, start_date, end_date))
            sleep_stats = cursor.fetchone()

            health_data = {
                'meal_stats': meal_stats,
                'sleep_stats': sleep_stats
            }
            return health_data
    except mysql.connector.Error as err:
        print(f"Error retrieving health stats: {err}")
    finally:
        if db:
            db.close()

    return {}
