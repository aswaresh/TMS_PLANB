from flask import Flask, render_template, redirect
from utils.db import db
from flask_cors import CORS
from models import Class, User
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from utils.backup import create_backup
import threading
import time
from dotenv import load_dotenv
import os

# ✅ Load environment variables
load_dotenv()

# ✅ Create Flask app
app = Flask(__name__)

# ✅ Get DB URL from .env
db_url = os.getenv("DATABASE_URL")

if not db_url:
    raise ValueError("DATABASE_URL is not set!")

# ✅ Fix postgres:// issue
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# ✅ Apply config
app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "fallback-secret")

# ✅ Initialize extensions
db.init_app(app)
CORS(app)

# ✅ Import and register blueprints
from routes.auth import auth_bp
from routes.views import view_bp

app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(view_bp)

# ✅ Create tables and default users (FIRST RUN ONLY)
with app.app_context():
    db.create_all()

    if not User.query.filter_by(username="admin1").first():
        db.session.add(User(
            name="Admin",
            username="admin1",
            password=generate_password_hash("1234"),
            role="admin,teacher"
        ))

    if not User.query.filter_by(username="teacher1").first():
        db.session.add(User(
            name="Teacher",
            username="teacher1",
            password=generate_password_hash("1234"),
            role="teacher"
        ))

    if not User.query.filter_by(username="student1").first():
        db.session.add(User(
            name="Ravi",
            username="student1",
            password=generate_password_hash("1234"),
            role="student"
        ))

    db.session.commit()

# ✅ Home route
@app.route("/")
def home():
    return redirect("/login")

# ✅ Reminder Logic
def check_reminders():
    now = datetime.now()

    classes = Class.query.all()

    for c in classes:
        if not c.date or not c.time:
            continue

        class_time = datetime.strptime(
            f"{c.date} {c.time.split(' - ')[0]}",
            "%Y-%m-%d %H:%M"
        )

        reminder_time = class_time - timedelta(minutes=30)

        if reminder_time <= now <= class_time:
            print(f"🔔 Reminder: Class for student {c.student_id} with teacher {c.teacher_id} at {c.time}")

    print("Checking reminders...")

# ✅ Daily Backup
last_backup_date = None

def check_daily_backup():
    global last_backup_date

    today = datetime.now().date()

    if last_backup_date != today:
        create_backup()
        last_backup_date = today
        print("✅ Daily backup done")

# ✅ Background worker
def run_reminder():
    while True:
        with app.app_context():
            check_daily_backup()
            check_reminders()
        time.sleep(60)

# ✅ Example dashboard route
@app.route('/student_dashboard')
def student_dashboard():
    return render_template('student_dashboard.html')


# ✅ Run locally only
if __name__ == "__main__":
    if os.getenv("ENV") == "development":
        reminder_thread = threading.Thread(target=run_reminder, daemon=True)
        reminder_thread.start()

    app.run(debug=True, use_reloader=False)