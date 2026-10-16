import os
from datetime import date
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__, static_folder="static")
CORS(app)  # Convenient for local development; same-origin requests work without it too.

def get_db_connection():
    """Create a new MySQL connection for each request."""
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "study_planner"),
    )

def task_to_dict(row):
    return {
        "id": row[0],
        "title": row[1],
        "subject": row[2],
        "priority": row[3],
        "due_date": row[4].isoformat() if row[4] else None,
        "completed": bool(row[5]),
        "created_at": row[6].isoformat(sep=" ", timespec="seconds") if row[6] else None,
    }

@app.get("/")
def home():
    return send_from_directory("static", "index.html")

@app.get("/api/health")
def health():
    try:
        connection = get_db_connection()
        connection.close()
        return jsonify({"ok": True, "message": "Flask and MySQL are connected."})
    except Error as exc:
        app.logger.exception("Database health check failed")
        return jsonify({"ok": False, "message": "Cannot connect to MySQL. Check your .env settings and database setup.", "detail": str(exc)}), 500

@app.get("/api/study-sessions")
def list_study_sessions():
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, day_of_week, subject, topic,
                   TIME_FORMAT(start_time, '%H:%i') AS start_time,
                   TIME_FORMAT(end_time, '%H:%i') AS end_time,
                   notes, created_at
            FROM study_sessions
            ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday',
                'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
                start_time
        """)
        sessions = cursor.fetchall()
        for session in sessions:
            if session["created_at"]:
                session["created_at"] = session["created_at"].isoformat(sep=" ", timespec="seconds")
        cursor.close()
        return jsonify(sessions)
    except Error:
        app.logger.exception("Could not list study sessions")
        return jsonify({"error": "Could not load study sessions."}), 500
    finally:
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/study-sessions")
def create_study_session():
    data = request.get_json(silent=True) or {}

    day = data.get("day_of_week", "")
    subject = str(data.get("subject", "")).strip()
    topic = str(data.get("topic") or "").strip() or None
    start_time = data.get("start_time", "")
    end_time = data.get("end_time", "")
    notes = str(data.get("notes") or "").strip() or None

    valid_days = (
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday"
    )

    if day not in valid_days:
        return jsonify({"error": "Please select a valid day."}), 400
    if not subject or len(subject) > 100:
        return jsonify({"error": "Subject is required (maximum 100 characters)."}), 400
    if topic and len(topic) > 160:
        return jsonify({"error": "Topic must be 160 characters or fewer."}), 400
    if notes and len(notes) > 500:
        return jsonify({"error": "Notes must be 500 characters or fewer."}), 400

    try:
        start = date.fromisoformat("2000-01-01")
        from datetime import time
        start_value = time.fromisoformat(start_time)
        end_value = time.fromisoformat(end_time)
        if start_value >= end_value:
            return jsonify({"error": "End time must be later than start time."}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "Enter valid start and end times."}), 400

    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO study_sessions
                (day_of_week, subject, topic, start_time, end_time, notes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (day, subject, topic, start_time, end_time, notes))
        connection.commit()
        new_id = cursor.lastrowid
        cursor.close()
        return jsonify({"id": new_id, "message": "Study session added."}), 201
    except Error:
        app.logger.exception("Could not create study session")
        return jsonify({"error": "Could not save the study session."}), 500
    finally:
        if connection and connection.is_connected():
            connection.close()


@app.delete("/api/study-sessions/<int:session_id>")
def delete_study_session(session_id):
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "DELETE FROM study_sessions WHERE id = %s",
            (session_id,)
        )
        connection.commit()
        deleted = cursor.rowcount
        cursor.close()

        if not deleted:
            return jsonify({"error": "Study session not found."}), 404

        return jsonify({"message": "Study session deleted."})
    except Error:
        app.logger.exception("Could not delete study session")
        return jsonify({"error": "Could not delete the study session."}), 500
    finally:
        if connection and connection.is_connected():
            connection.close()

@app.get("/api/tasks")
def list_tasks():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT id, title, subject, priority, due_date, completed, created_at
            FROM tasks
            ORDER BY completed ASC,
                     due_date IS NULL ASC,
                     due_date ASC,
                     id DESC
        """)
        tasks = [task_to_dict(row) for row in cursor.fetchall()]
        cursor.close()
        connection.close()
        return jsonify(tasks)
    except Error:
        app.logger.exception("Could not list tasks")
        return jsonify({"error": "Could not load tasks. Check your MySQL setup."}), 500

@app.post("/api/tasks")
def create_task():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    subject = str(data.get("subject", "")).strip()
    priority = data.get("priority", "Medium")
    due_date = data.get("due_date") or None

    if not title:
        return jsonify({"error": "Task title is required."}), 400
    if len(title) > 160 or len(subject) > 100:
        return jsonify({"error": "Title must be 160 characters or fewer and subject 100 characters or fewer."}), 400
    if priority not in ("Low", "Medium", "High"):
        return jsonify({"error": "Priority must be Low, Medium, or High."}), 400
    if due_date:
        try:
            date.fromisoformat(due_date)
        except (TypeError, ValueError):
            return jsonify({"error": "Due date must be a valid date."}), 400

    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO tasks (title, subject, priority, due_date) VALUES (%s, %s, %s, %s)",
            (title, subject or None, priority, due_date),
        )
        connection.commit()
        new_id = cursor.lastrowid
        cursor.execute(
            "SELECT id, title, subject, priority, due_date, completed, created_at FROM tasks WHERE id = %s",
            (new_id,),
        )
        task = task_to_dict(cursor.fetchone())
        cursor.close()
        connection.close()
        return jsonify(task), 201
    except Error:
        if connection and connection.is_connected():
            connection.rollback()
            connection.close()
        app.logger.exception("Could not create task")
        return jsonify({"error": "Could not save the task to MySQL."}), 500

@app.put("/api/tasks/<int:task_id>")
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    subject = str(data.get("subject", "")).strip()
    priority = data.get("priority", "Medium")
    due_date = data.get("due_date") or None
    completed = data.get("completed", False)

    if not title:
        return jsonify({"error": "Task title is required."}), 400
    if len(title) > 160 or len(subject) > 100:
        return jsonify({"error": "Title must be 160 characters or fewer and subject 100 characters or fewer."}), 400
    if priority not in ("Low", "Medium", "High"):
        return jsonify({"error": "Priority must be Low, Medium, or High."}), 400
    if not isinstance(completed, bool):
        return jsonify({"error": "Completed must be true or false."}), 400
    if due_date:
        try:
            date.fromisoformat(due_date)
        except (TypeError, ValueError):
            return jsonify({"error": "Due date must be a valid date."}), 400

    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """UPDATE tasks
               SET title = %s, subject = %s, priority = %s, due_date = %s, completed = %s
               WHERE id = %s""",
            (title, subject or None, priority, due_date, completed, task_id),
        )
        connection.commit()
        if cursor.rowcount == 0:
            cursor.execute("SELECT id FROM tasks WHERE id = %s", (task_id,))
            if cursor.fetchone() is None:
                cursor.close()
                connection.close()
                return jsonify({"error": "Task not found."}), 404
        cursor.execute(
            "SELECT id, title, subject, priority, due_date, completed, created_at FROM tasks WHERE id = %s",
            (task_id,),
        )
        task = task_to_dict(cursor.fetchone())
        cursor.close()
        connection.close()
        return jsonify(task)
    except Error:
        if connection and connection.is_connected():
            connection.rollback()
            connection.close()
        app.logger.exception("Could not update task")
        return jsonify({"error": "Could not update the task."}), 500

@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
        connection.commit()
        deleted = cursor.rowcount
        cursor.close()
        connection.close()
        if not deleted:
            return jsonify({"error": "Task not found."}), 404
        return jsonify({"message": "Task deleted."})
    except Error:
        if connection and connection.is_connected():
            connection.rollback()
            connection.close()
        app.logger.exception("Could not delete task")
        return jsonify({"error": "Could not delete the task."}), 500

if __name__ == "__main__":
    # Debug is helpful locally. Turn it off before deploying publicly.
    app.run(host="127.0.0.1", port=5000, debug=True)
