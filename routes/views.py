from flask import Blueprint, render_template
from models import User, Class, Fee


view_bp = Blueprint('view', __name__)

@view_bp.route('/')
def dashboard():
    total_students = User.query.filter(User.role.contains('student')).count()

    total_classes = Class.query.count()
    present = Class.query.filter_by(attendance='present').count()

    attendance_percentage = round((present / total_classes) * 100, 2) if total_classes > 0 else 0

    pending_fees = Fee.query.filter_by(status='pending').count()

    # ✅ NEW: Amount calculations
    pending_amount = sum(f.amount for f in Fee.query.filter_by(status='pending').all())
    collected_amount = sum(f.amount for f in Fee.query.filter_by(status='paid').all())

    return render_template(
        'dashboard.html',
        total_students=total_students,
        attendance=attendance_percentage,
        pending_fees=pending_fees,
        pending_amount=pending_amount,
        collected_amount=collected_amount
    )

@view_bp.route('/students')
def students():
    students = User.query.User.role.contains('student').all()

    return render_template('students.html', students=students)

@view_bp.route('/teacher_dashboard')
def teacher_dashboard():
    return render_template('teacher_dashboard.html')

@view_bp.route('/schedule')
def schedule():
    return render_template('schedule.html')

@view_bp.route('/attendance')
def attendance():
    classes = Class.query.all()

    data = []
    for c in classes:
        student = User.query.get(c.student_id)

        data.append({
            "id": c.id,
            "student_name": student.name if student else "Unknown",
            "date": c.date,
            "time": c.time,
            "attendance": c.attendance
        })

    return render_template('attendance.html', classes=data)

@view_bp.route('/fees')
def fees():
    fees = Fee.query.all()

    data = []
    for f in fees:
        student = User.query.get(f.student_id)

        data.append({
            "id": f.id,
            "student_name": student.name if student else "Unknown",
            "month": f.month,
            "amount": f.amount,
            "status": f.status
        })

    return render_template('fees.html', fees=data)

@view_bp.route('/login')
def login_page():
    return render_template('login.html')

@view_bp.route('/teacher_slots')
def teacher_slots():
    return render_template('teacher_slots.html')
from flask import render_template

@view_bp.route('/teacher_classes')
def teacher_classes_page():
    return render_template('teacher_classes.html')

@view_bp.route('/admin_schedule')
def admin_schedule():
    return render_template('admin_schedule.html')

@view_bp.route('/admin_master')
def admin_master():
    return render_template('admin_master.html')

@view_bp.route('/admin_attendance')
def admin_attendance():
    return render_template('admin_attendance.html')

@view_bp.route('/calendar')
def calendar():
    return render_template('calendar.html')

@view_bp.route('/teacher_calendar')
def teacher_calendar_page():
    return render_template('teacher_calendar.html')

@view_bp.route('/attendance_report')
def attendance_report():
    return render_template('attendance_report.html')

@view_bp.route('/change_password_page')
def change_password_page():
    return render_template('change_password.html')

@view_bp.route('/admin_backup')
def admin_backup():
    return render_template('admin_backup.html')

@view_bp.route('/fee_management')
def fee_management():
    return render_template('fee_management.html')


