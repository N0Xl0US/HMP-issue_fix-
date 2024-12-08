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
    connection = mysql.connector.connect(
        host='your_host',
        user='your_user',
        password='your_password',
        database='your_database'
    )
    cursor = connection.cursor()

    # Join meals table to include nutritional info
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

    # Build a dictionary or list to return the data
    stats = {}
    for meal in meals:
        meal_data = {
            'meal_id': meal[0],
            'total_quantity': meal[1],
            'calories': meal[2],
            'proteins': meal[3],
            'carbs': meal[4],
            'fats': meal[5],
            'sugar': meal[6]
        }
        # Use the meal name or type as the key (Breakfast, Snack, etc.)
        # You may need to adjust how meal types are stored
        stats[meal[0]] = meal_data  # Or use a more descriptive key

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


def get_meal_data_by_id(meal_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        query = """
            SELECT meal_name, calories, sugar, carbs, proteins, fats
            FROM meals
            WHERE meal_id = %s
        """
        cursor.execute(query, (meal_id,))
        meal_data = cursor.fetchone()

        cursor.close()

        if meal_data:
            return {
                "meal_name": meal_data['meal_name'],
                "calories": meal_data['calories'],
                "sugar": meal_data['sugar'],
                "carbs": meal_data['carbs'],
                "proteins": meal_data['proteins'],
                "fats": meal_data['fats']
            }
        else:
            return None
    except Exception as e:
        print(f"Error fetching meal data: {e}")
        return None