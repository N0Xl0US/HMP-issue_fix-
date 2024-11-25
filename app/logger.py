import mysql.connector
from datetime import datetime


def log_action(user_id, action_type, description):
    connection = mysql.connector.connect(
        host="localhost",
        user="root",
        password="AutoSuggestion0",
        database="healthy_meal_planner"
    )
    cursor = connection.cursor()
    try:
        query = """
            INSERT INTO audit_logs (user_id, action_type, action_date, description)
            VALUES (%s, %s, %s, %s)
        """
        action_date = datetime.now()
        cursor.execute(query, (user_id, action_type, action_date, description))
        connection.commit()
    except Exception as e:
        print(f"Failed to log action: {e}")
    finally:
        cursor.close()
        connection.close()