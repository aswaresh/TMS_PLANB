from flask import Blueprint, request, jsonify
from models import User
from utils.db import db
from flask_bcrypt import Bcrypt
from models import Class
from models import Fee
from models import PendingStudent
from models import Subject
from models import Standard
from werkzeug.security import check_password_hash
from models import Teacher
from utils.backup import create_backup

MAX_FUTURE_CLASSES = 1

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()

from models import PendingStudent

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    student = PendingStudent(
        name=data['name'],
        parent_name=data['parent_name'],
        phone=data['phone'],
        course=data['course'],
        username=data['username'],
        password=hashed_password
    )

    db.session.add(student)
    db.session.commit()

    return jsonify({"message": "Registration submitted. Waiting for admin approval"})

@auth_bp.route('/approve/<int:id>', methods=['POST'])
def approve_student(id):

    pending = PendingStudent.query.get(id)

    if not pending:
        return jsonify({"message": "Student not found"}), 404

    existing_user = User.query.filter_by(username=pending.username).first()

    if existing_user:
        return jsonify({"message": "User already exists"}), 400

    user = User(
        name=pending.name,
        username=pending.username,
        password=pending.password,
        role="student"   
    )

    db.session.add(user)
    db.session.commit()

    pending.status = "approved"
    db.session.commit()

    return jsonify({"message": "Student approved successfully"})

from flask import request, jsonify
from models import User

@auth_bp.route('/login', methods=['POST'])
def login():

    from models import User, Teacher   # ✅ FIX HERE
    from werkzeug.security import check_password_hash

    data = request.get_json()

    user = User.query.filter_by(username=data['username']).first()

    if not user:
        return jsonify({"message": "Invalid username"}), 401

    if not check_password_hash(user.password, data['password']):
        return jsonify({"message": "Invalid password"}), 401

    # ✅ GET TEACHER RECORD
    teacher = Teacher.query.filter_by(user_id=user.id).first()

    print("Teacher found:", teacher)  # ✅ DEBUG (add temporarily)

    return jsonify({
        "message": "Login successful",
        "user_id": user.id,
        "roles": user.role,
        "name": user.name if user.name else user.username,
        "teacher_id": teacher.id if teacher else None
    })


@auth_bp.route('/mark_attendance', methods=['POST'])
def mark_attendance():

    from models import Class, User, ScheduleRule
    from datetime import datetime, timedelta
    from utils.db import db

    data = request.get_json()

    class_id = data['class_id']
    attendance = data['attendance']
    user_id = data.get('user_id')

    cls = Class.query.get(class_id)

    if not cls:
        return jsonify({"message": "Class not found"}), 404

    # ✅ GET USER ROLE
    user = User.query.get(user_id)
    role = user.role if user else ""

    today = datetime.today().date()
    class_date = datetime.strptime(cls.date, "%Y-%m-%d").date()

    # ✅ VALIDATION FOR TEACHER
    if "admin" not in role:
        if today < class_date or today > class_date + timedelta(days=1):
            return jsonify({
                "message": "Attendance can be marked only on class date or next day"
            }), 400

    # ✅ SAVE ATTENDANCE
    cls.attendance = attendance

    if attendance in ["present", "absent"]:
        cls.status = "completed"

    db.session.commit()

    # ✅ ✅ ✅ NEW LOGIC: GENERATE NEXT CLASS ONLY FOR RECURRING

    rule = ScheduleRule.query.filter_by(
        student_id=cls.student_id,
        teacher_id=cls.teacher_id,
        subject=cls.subject,
        time=cls.time,
        status="active"
    ).first()

    if rule and rule.is_recurring:

        day_map = {
            "Monday": 0, "Tuesday": 1, "Wednesday": 2,
            "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6
        }

        current_date = datetime.strptime(cls.date, "%Y-%m-%d")

        next_dates = []

        for d in rule.days:
            target_day = day_map[d]

            days_ahead = target_day - current_date.weekday()

            if days_ahead <= 0:
                days_ahead += 7

            next_date = current_date + timedelta(days=days_ahead)
            next_dates.append(next_date)

        # ✅ pick nearest next valid date
        next_class_date = min(next_dates).strftime("%Y-%m-%d")

        # ✅ PREVENT DUPLICATE CLASS
        exists = Class.query.filter_by(
            student_id=cls.student_id,
            teacher_id=cls.teacher_id,
            subject=cls.subject,
            date=next_class_date,
            time=cls.time
        ).first()

        if not exists:
            new_class = Class(
                student_id=cls.student_id,
                teacher_id=cls.teacher_id,
                subject=cls.subject,
                date=next_class_date,
                time=cls.time,
                status="scheduled",
                rule_id=rule.id
            )

            db.session.add(new_class)
            db.session.commit()

    return jsonify({"message": "Attendance updated successfully"})

@auth_bp.route('/attendance/<int:student_id>', methods=['GET'])
def get_attendance(student_id):
    classes = Class.query.filter_by(student_id=student_id).all()

    result = []
    for c in classes:
        result.append({
            "date": c.date,
            "time": c.time,
            "attendance": c.attendance
        })

    return jsonify(result)

@auth_bp.route('/attendance_summary/<int:student_id>', methods=['GET'])
def attendance_summary(student_id):
    classes = Class.query.filter_by(student_id=student_id).all()

    total = len(classes)
    present = sum(1 for c in classes if c.attendance == "present")
    absent = sum(1 for c in classes if c.attendance == "absent")

    percentage = (present / total * 100) if total > 0 else 0

    return jsonify({
        "total_classes": total,
        "present": present,
        "absent": absent,
        "attendance_percentage": round(percentage, 2)
    })

@auth_bp.route('/add_fee', methods=['POST'])
def add_fee():
    data = request.get_json()

    fee = Fee(
        student_id=data['student_id'],
        amount=data['amount'],
        month=data['month']
    )

    db.session.add(fee)
    db.session.commit()

    return jsonify({"message": "Fee added successfully"})

@auth_bp.route('/pay_fee', methods=['POST'])
def pay_fee_paid():
    data = request.get_json()

    fee = Fee.query.get(data['fee_id'])

    if not fee:
        return jsonify({"message": "Fee record not found"}), 404

    fee.status = "paid"

    db.session.commit()

    return jsonify({"message": "Fee marked as paid"})

@auth_bp.route('/fees/<int:student_id>', methods=['GET'])
def get_student_fees(student_id):
    fees = Fee.query.filter_by(student_id=student_id).all()

    result = []
    for f in fees:
        result.append({
            "month": f.month,
            "amount": f.amount,
            "status": f.status
        })

    return jsonify(result)

@auth_bp.route('/pending', methods=['GET'])
def get_pending():
    students = PendingStudent.query.filter_by(status="pending").all()

    result = []
    for s in students:
        result.append({
            "id": s.id,
            "name": s.name,
            "course": s.course
        })

    return jsonify(result)

@auth_bp.route('/create_user', methods=['POST'])
def create_user():
    data = request.get_json()

    # ✅ check duplicate username
    existing = User.query.filter_by(username=data['username']).first()
    if existing:
        return jsonify({"message": "Username already exists"}), 400

    user = User(
        name=data['name'],
        username=data['username'],
        password=data['password'],
        role=data['role']
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User created successfully"})

@auth_bp.route('/teacher_stats/<int:teacher_id>', methods=['GET'])
def teacher_stats(teacher_id):

    from models import Class
    from datetime import datetime
    from flask import request, jsonify

    month = request.args.get("month")

    classes = Class.query.filter_by(teacher_id=teacher_id).all()

    filtered = []

    for c in classes:

        if not c.date:
            continue

        if month:
            try:
                class_month = datetime.strptime(c.date, "%Y-%m-%d").strftime("%Y-%m")
                if class_month != month:
                    continue
            except:
                continue

        filtered.append(c)

    total = len(filtered)   # ✅ includes cancelled

    completed = len([
        c for c in filtered 
        if c.attendance in ["present", "absent"]
    ])

    # ✅ ✅ FIXED HERE
    pending = len([
        c for c in filtered 
        if c.attendance == "pending" and c.status != "cancelled"
    ])

    cancelled = len([
        c for c in filtered 
        if c.status == "cancelled"
    ])

    return jsonify({
        "total": total,
        "completed": completed,
        "pending": pending,
        "cancelled": cancelled
    })



@auth_bp.route('/teacher_classes/<int:teacher_id>', methods=['GET'])
def teacher_classes(teacher_id):

    from models import Class, Student

    classes = Class.query.filter_by(teacher_id=teacher_id).all()

    data = []

    for c in classes:

        student = Student.query.get(c.student_id)

        data.append({
            "class_id": c.id,
            "student": student.name if student else "",
            "date": c.date,
            "time": c.time,
            "status": c.status,
            "attendance": c.attendance,
            "subject": c.subject
        })

    return jsonify(data)

@auth_bp.route('/student_classes/<int:user_id>', methods=['GET'])
def student_classes(user_id):

    from models import Class, Student

    # ✅ Convert user → student
    student = Student.query.filter_by(user_id=user_id).first()

    if not student:
        return jsonify([])

    classes = Class.query.filter_by(student_id=student.id).all()

    data = []

    for c in classes:
        data.append({
            "date": c.date,
            "time": c.time,
            "status": c.attendance,
            "subject": c.subject
        })

    return jsonify(data)

@auth_bp.route('/attendance_subject_summary/<int:user_id>', methods=['GET'])
def attendance_subject_summary(user_id):

    from models import Class, Student
    from datetime import datetime

    month = request.args.get("month")

    # ✅ Convert user → student
    student = Student.query.filter_by(user_id=user_id).first()

    if not student:
        return jsonify({})

    classes = Class.query.filter_by(student_id=student.id).all()

    summary = {}

    for c in classes:
        print("Class Date:", c.date, type(c.date), "Month:", month)   # ✅ DEBUG
        # ✅ Skip pending
        if c.attendance not in ["present", "absent"]:
            continue

        # ✅ ✅ NEW: Use Class.date directly (no slot)
        if month:
            try:
                # ✅ HANDLE BOTH STRING & DATE TYPES
                if isinstance(c.date, str):
                    class_month = datetime.strptime(c.date, "%Y-%m-%d").strftime("%Y-%m")
                else:
                    class_month = c.date.strftime("%Y-%m")

                if class_month != month:
                    continue

            except Exception as e:
                print("Month filter error:", e)
                continue

        # ✅ Subject check
        if not c.subject:
            continue

        subject = c.subject

        if subject not in summary:
            summary[subject] = {
                "total": 0,
                "present": 0,
                "absent": 0
            }

        summary[subject]["total"] += 1

        if c.attendance == "present":
            summary[subject]["present"] += 1
        elif c.attendance == "absent":
            summary[subject]["absent"] += 1

    # ✅ Calculate %
    for subject in summary:
        total = summary[subject]["total"]
        present = summary[subject]["present"]

        percentage = (present / total * 100) if total > 0 else 0
        summary[subject]["percentage"] = round(percentage, 2)

    return jsonify(summary)

@auth_bp.route('/get_subjects', methods=['GET'])
def get_subjects():

    standard_id = request.args.get('standard_id')

    query = Subject.query

    if standard_id:
        query = query.filter_by(standard_id=standard_id)

    subjects = query.all()

    return jsonify([
        {
            "id": s.id,
            "name": s.name,
            "standard": s.standard.name   # ✅ ADD THIS
        }
        for s in subjects
    ])

@auth_bp.route('/delete_subject/<int:id>', methods=['DELETE'])
def delete_subject(id):

    subject = Subject.query.get(id)

    if subject:
        db.session.delete(subject)
        db.session.commit()

    return jsonify({"message": "Deleted"})

@auth_bp.route('/add_standard', methods=['POST'])
def add_standard():
    data = request.get_json()

    std = Standard(name=data['name'])
    db.session.add(std)
    db.session.commit()

    return jsonify({"message": "Standard added"})

@auth_bp.route('/get_standards', methods=['GET'])
def get_standards():
    standards = Standard.query.all()
    return jsonify([{"id": s.id, "name": s.name} for s in standards])

@auth_bp.route('/add_subject', methods=['POST'])
def add_subject():

    data = request.get_json()

    subject = Subject(
        name=data['name'],
        standard_id=data['standard_id']
    )

    db.session.add(subject)
    db.session.commit()

    return jsonify({"message": "Subject added"})

@auth_bp.route('/add_student', methods=['POST'])
def add_student():

    from models import Student, Subject, User
    from werkzeug.security import generate_password_hash

    data = request.get_json()
    
    existing = User.query.filter_by(username=data['username']).first()
    if existing:
        return jsonify({"message": "Username already exists"}), 400

    # ✅ CREATE USER LOGIN
    user = User(
        name=data['name'].upper(),
        username=data['username'],
        password=generate_password_hash(data['password']),
        role='student'
    )

    db.session.add(user)
    db.session.flush()  # ✅ get user.id

    # ✅ CREATE STUDENT
    student = Student(
        name=data['name'],
        parent_name=data['parent_name'],
        contact=data['contact'],
        standard_id=data['standard_id'],
        monthly_fee=data['monthly_fee'],
        fee_due_day=data.get('fee_due_day'),
        user_id=user.id   # ✅ link
    )

    subjects = Subject.query.filter(Subject.id.in_(data['subject_ids'])).all()
    student.subjects = subjects

    db.session.add(student)
    db.session.commit()
    create_backup()

    # print("User created:", user.username)

    return jsonify({"message": "Student + Login created successfully"})

@auth_bp.route('/get_students', methods=['GET'])
def get_students():

    from models import Student

    students = Student.query.all()

    result = []

    for s in students:
        result.append({
            "id": s.id,
            "name": s.name,
            "parent": s.parent_name,
            "contact": s.contact,
            "standard": s.standard.name if s.standard else "",   # ✅ safe
            "standard_id": s.standard_id,
            "subjects": [sub.name for sub in s.subjects] if s.subjects else [],  # ✅ safe
            "fee": s.monthly_fee if s.monthly_fee else 0,   # ✅ safe            
            "user_id": s.user_id,
            "fee_due_day": s.fee_due_day,
            "username": User.query.get(s.user_id).username if s.user_id else ""
        })

    return jsonify(result)

@auth_bp.route('/delete_student/<int:id>', methods=['DELETE'])
def delete_student(id):

    from models import Student, User

    student = Student.query.get(id)

    if not student:
        return jsonify({"message": "Student not found"}), 404

    # ✅ DELETE LINKED USER (ADD HERE)
    user = User.query.get(student.user_id)
    if user:
        db.session.delete(user)

    # ✅ DELETE STUDENT
    db.session.delete(student)

    db.session.commit()

    return jsonify({"message": "Student deleted successfully"})

@auth_bp.route('/update_student/<int:id>', methods=['PUT'])
def update_student(id):

    from models import Student, Subject, User
    from werkzeug.security import generate_password_hash

    student = Student.query.get(id)

    if not student:
        return jsonify({"message": "Student not found"}), 404

    data = request.get_json()
    
    print("Password received:", data.get('password'))  # ✅ DEBUG LINE (ADD HERE)  
    if data.get('password'):
        user = User.query.get(student.user_id)
        if user:
            user.password = generate_password_hash(data['password'])
            print("Password updated for user:", user.username)

    # ✅ update student fields
    student.name = data['name']
    student.parent_name = data['parent_name']
    student.contact = data['contact']
    student.standard_id = data['standard_id']
    student.monthly_fee = data['monthly_fee']
    student.fee_due_day = data.get('fee_due_day')

    # ✅ update subjects
    subjects = Subject.query.filter(Subject.id.in_(data['subject_ids'])).all()
    student.subjects = subjects

    # ✅ PASSWORD RESET LOGIC
    if data.get('password'):   # ✅ only if provided
        user = User.query.get(student.user_id)
        if user:
            user.password = generate_password_hash(data['password'])

    db.session.commit()

    return jsonify({"message": "Student updated successfully"})

@auth_bp.route('/add_teacher', methods=['POST'])
def add_teacher():

    from models import Teacher, Subject, User
    from werkzeug.security import generate_password_hash

    data = request.get_json()

    print("Teacher data received:", data)  # ✅ debug

    existing = User.query.filter_by(username=data['username']).first()
    if existing:
        return jsonify({"message": "Username already exists"}), 400

    # ✅ CREATE USER
    role = data.get("role", "teacher")

    user = User(
        name=data['name'].upper(),
        username=data['username'],
        password=generate_password_hash(data['password']),
        role=role   # ✅ dynamic role
    )
    db.session.add(user)
    db.session.flush()
    

    # ✅ CREATE TEACHER
    subjects = data.get('subjects', [])
    subjects = list(set(subjects))
    teacher = Teacher(
        name=data['name'],
        qualification=data['qualification'],
        experience=data['experience'],
        phone=data['phone'],
        email=data['email'],
        standard_id = data.get('standard_id'),
        user_id=user.id
    )
    teacher.subjects = ",".join(subjects)
    # subjects = Subject.query.filter(Subject.id.in_(data['subject_ids'])).all()
    # teacher.subjects = subjects

    db.session.add(teacher)
    db.session.commit()
    create_backup()
    return jsonify({"message": "Teacher created successfully"})

@auth_bp.route('/get_teachers', methods=['GET'])
def get_teachers():

    from models import Teacher

    teachers = Teacher.query.all()

    return jsonify([
        {
            "id": t.id,
            "name": t.name,
            "qualification": t.qualification,
            "experience": t.experience,
            "phone": t.phone,
            "email": t.email,
            "subjects": t.subjects,   # ✅ FIXED
            "standard_id": t.standard_id,
            "user_id": t.user_id,
            "username": User.query.get(t.user_id).username if t.user_id else ""
        }
        for t in teachers
    ])

@auth_bp.route('/delete_teacher/<int:id>', methods=['DELETE'])
def delete_teacher(id):

    from models import Teacher, User

    teacher = Teacher.query.get(id)

    if not teacher:
        return jsonify({"message": "Teacher not found"}), 404

    # ✅ DELETE LINKED USER
    user = User.query.get(teacher.user_id)
    if user:
        db.session.delete(user)

    db.session.delete(teacher)
    db.session.commit()

    return jsonify({"message": "Teacher deleted successfully"})

@auth_bp.route('/update_teacher/<int:id>', methods=['PUT'])
def update_teacher(id):

    from models import Teacher, Subject, User
    from werkzeug.security import generate_password_hash

    teacher = Teacher.query.get(id)

    if not teacher:
        return jsonify({"message": "Teacher not found"}), 404

    data = request.get_json()

    teacher.name = data['name']
    teacher.qualification = data['qualification']
    teacher.experience = data['experience']
    teacher.phone = data['phone']
    teacher.email = data['email']
    teacher.standard_id = data['standard_id']

    subjects = data.get('subjects', [])
    subjects = list(set(subjects))
    teacher.subjects = ",".join(subjects)

    if data.get('password'):
        user = User.query.get(teacher.user_id)
        if user:
            user.password = generate_password_hash(data['password'])

    db.session.commit()

    return jsonify({"message": "Teacher updated successfully"})


from datetime import datetime, timedelta

def generate_classes():
    print("generate_classes() disabled ✅")
    return

def is_overlap(start1, end1, start2, end2):
    from datetime import datetime

    fmt = "%H:%M"

    s1 = datetime.strptime(start1.strip(), fmt)
    e1 = datetime.strptime(end1.strip(), fmt)
    s2 = datetime.strptime(start2.strip(), fmt)
    e2 = datetime.strptime(end2.strip(), fmt)

    return max(s1, s2) < min(e1, e2)

@auth_bp.route('/add_schedule', methods=['POST'])
def add_schedule():

    from models import ScheduleRule, Class
    from datetime import datetime

    data = request.get_json()

    student_id = data['student_id']
    teacher_id = data['teacher_id']
    subject = data['subject']
    days = data['days']
    time = data['time']

    # ✅ default
    is_recurring = data.get('is_recurring', False)

    print("DEBUG teacher_id received:", teacher_id)
    print("DEBUG is_recurring:", is_recurring)

    # ✅ TIME SPLIT
    new_start, new_end = time.split(" - ")

    # ✅ STUDENT CONFLICT CHECK
    student_rules = ScheduleRule.query.filter(
        ScheduleRule.student_id == student_id,
        ScheduleRule.status == "active"
    ).all()

    for rule in student_rules:
        old_start, old_end = rule.time.split(" - ")

        if any(d in rule.days for d in days):
            if is_overlap(new_start, new_end, old_start, old_end):
                return jsonify({"message": "Student already has overlapping class"}), 400

    # ✅ TEACHER CONFLICT CHECK
    teacher_rules = ScheduleRule.query.filter(
        ScheduleRule.teacher_id == teacher_id,
        ScheduleRule.status == "active"
    ).all()

    for rule in teacher_rules:
        old_start, old_end = rule.time.split(" - ")

        if any(d in rule.days for d in days):
            if is_overlap(new_start, new_end, old_start, old_end):
                return jsonify({"message": "Teacher not available (time overlap)"}), 400

    # ✅ SAVE RULE
    rule = ScheduleRule(
        student_id=student_id,
        teacher_id=teacher_id,
        subject=subject,
        days=days,
        time=time,
        is_recurring=is_recurring
    )

    db.session.add(rule)
    db.session.commit()

    # ✅  ALWAYS CREATE ONLY ONE CLASS

    first_day = days[0]
    class_date = get_next_date(first_day)

    # ✅ avoid duplicate (very important)
    exists = Class.query.filter_by(
        student_id=student_id,
        teacher_id=teacher_id,
        subject=subject,
        date=class_date,
        time=time
    ).first()

    if not exists:
        new_class = Class(
            student_id=student_id,
            teacher_id=teacher_id,
            subject=subject,
            date=class_date,
            time=time,
            status="scheduled",
            rule_id=rule.id   # ✅ IMPORTANT (link rule)
        )

        db.session.add(new_class)
        db.session.commit()
        create_backup()
    return jsonify({"message": "Schedule created successfully"})

from datetime import datetime, timedelta

def get_next_date(day_name):
    days_map = {
        "Monday": 0,
        "Tuesday": 1,
        "Wednesday": 2,
        "Thursday": 3,
        "Friday": 4,
        "Saturday": 5,
        "Sunday": 6
    }

    today = datetime.today()
    target_day = days_map[day_name]

    days_ahead = target_day - today.weekday()

    if days_ahead <= 0:
        days_ahead += 7

    next_date = today + timedelta(days=days_ahead)

    return next_date.strftime("%Y-%m-%d")

@auth_bp.route('/get_classes', methods=['GET'])
def get_classes():

    from models import Class, Student, Teacher, ScheduleRule

    classes = Class.query.all()

    # ✅ FETCH ALL RULES ONCE (OPTIMIZED)
    rules = ScheduleRule.query.all()
    rule_map = {r.id: r for r in rules}

    result = []

    for c in classes:

        student = Student.query.get(c.student_id)
        teacher = Teacher.query.get(c.teacher_id)

        # ✅ SAFE RULE FETCH
        rule = rule_map.get(c.rule_id)

        result.append({
            "id": c.id,
            "rule_id": c.rule_id,
            "student": student.name if student else "",
            "student_id": c.student_id,
            "teacher": teacher.name if teacher else "",
            "teacher_id": c.teacher_id,
            "subject": c.subject,
            "date": c.date,
            "time": c.time,
            "status": c.status,
            "attendance": c.attendance,

            # ✅ ✅ FIXED (NO ERROR)
            "is_recurring": rule.is_recurring if rule else False
        })

    return jsonify(result)

@auth_bp.route('/cancel_class/<int:class_id>', methods=['PUT'])
def cancel_class(class_id):

    from models import Class, ScheduleRule
    from datetime import datetime, timedelta
    from utils.db import db

    cls = Class.query.get(class_id)

    if not cls:
        return jsonify({"message": "Class not found"}), 404

    # ✅ MARK AS CANCELLED
    cls.status = "cancelled"
    db.session.commit()

    # ✅ ✅ ✅ GENERATE NEXT CLASS ONLY IF RECURRING

    rule = ScheduleRule.query.filter_by(
        student_id=cls.student_id,
        teacher_id=cls.teacher_id,
        subject=cls.subject,
        time=cls.time,
        status="active"
    ).first()

    if rule and rule.is_recurring:

        day_map = {
            "Monday": 0, "Tuesday": 1, "Wednesday": 2,
            "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6
        }

        current_date = datetime.strptime(cls.date, "%Y-%m-%d")

        next_dates = []

        for d in rule.days:
            target_day = day_map[d]

            days_ahead = target_day - current_date.weekday()

            if days_ahead <= 0:
                days_ahead += 7

            next_date = current_date + timedelta(days=days_ahead)
            next_dates.append(next_date)

        # ✅ nearest next date
        next_class_date = min(next_dates).strftime("%Y-%m-%d")

        # ✅ prevent duplicate
        exists = Class.query.filter_by(
            student_id=cls.student_id,
            teacher_id=cls.teacher_id,
            subject=cls.subject,
            date=next_class_date,
            time=cls.time
        ).first()

        if not exists:
            new_class = Class(
                student_id=cls.student_id,
                teacher_id=cls.teacher_id,
                subject=cls.subject,
                date=next_class_date,
                time=cls.time,
                status="scheduled",
                rule_id=rule.id
            )

            db.session.add(new_class)
            db.session.commit()

    return jsonify({"message": "Class cancelled successfully"})

@auth_bp.route('/stop_schedule/<int:id>', methods=['PUT'])
def stop_schedule(id):

    from models import ScheduleRule
    from utils.db import db

    rule = ScheduleRule.query.get(id)

    if not rule:
        return jsonify({"message": "Schedule not found"}), 404

    # ✅ STOP RECURRING
    rule.status = "inactive"

    db.session.commit()

    return jsonify({"message": "Schedule stopped successfully"})

@auth_bp.route('/update_class/<int:id>', methods=['PUT'])
def update_class(id):

    from models import Class
    from utils.db import db

    cls = Class.query.get(id)

    if not cls:
        return jsonify({"message": "Class not found"}), 404

    data = request.get_json()

    # ✅ prepare new values FIRST (DO NOT update yet)
    new_date = data.get("date", cls.date)
    new_time = data.get("time", cls.time)
    new_teacher_id = data.get("teacher_id", cls.teacher_id)

    # ✅ CHECK conflict BEFORE updating
    # ✅ Split new time
    new_start, new_end = new_time.split(" - ")

    # ✅ Get all classes of that teacher on same date
    teacher_classes = Class.query.filter(
        Class.teacher_id == new_teacher_id,
        Class.date == new_date,
        Class.id != cls.id   # ✅ VERY IMPORTANT
    ).all()

    # ✅ Check overlap
    for c in teacher_classes:

        old_start, old_end = c.time.split(" - ")

        if is_overlap(new_start, new_end, old_start, old_end):
            return jsonify({
                "message": "Teacher already has overlapping class"
            }), 400

    # ✅ NOW update safely
    cls.date = new_date
    cls.time = new_time
    cls.teacher_id = new_teacher_id

    if data.get("subject"):
        cls.subject = data["subject"]

    if cls.status == "scheduled":
        cls.status = "rescheduled"

    db.session.commit()
    create_backup()
    return jsonify({"message": "Class updated successfully"})

@auth_bp.route('/admin_classes', methods=['GET'])
def admin_classes():

    from models import Class, Student, Teacher

    classes = Class.query.all()

    data = []

    for c in classes:

        student = Student.query.get(c.student_id)
        teacher = Teacher.query.get(c.teacher_id)

        data.append({
            "class_id": c.id,
            "student": student.name if student else "",
            "teacher": teacher.name if teacher else "",
            "date": c.date,
            "time": c.time,
            "subject": c.subject,
            "attendance": c.attendance,
            "status": c.status
        })

    return jsonify(data)

@auth_bp.route('/teacher_calendar/<int:user_id>', methods=['GET'])
def teacher_calendar(user_id):

    from models import Class, Teacher, Student

    # ✅ convert user → teacher
    teacher = Teacher.query.filter_by(user_id=user_id).first()

    if not teacher:
        return jsonify([])

    classes = Class.query.filter_by(teacher_id=teacher.id).all()

    data = []

    for c in classes:

        student = Student.query.get(c.student_id)

        data.append({
            "id": c.id,
            "student": student.name if student else "",
            "subject": c.subject,
            "date": c.date,
            "time": c.time,
            "status": c.status,
            "attendance": c.attendance
        })

    return jsonify(data)
@auth_bp.route('/admin_attendance_report', methods=['GET'])
def admin_attendance_report():

    try:
        from models import Class, Student
        from datetime import datetime
        from flask import jsonify

        month = request.args.get("month")

        classes = Class.query.all()

        report = {}

        for c in classes:

            if c.attendance not in ["present", "absent"]:
                continue

            # ✅ SAFE date handling
            if month:
                try:
                    try:
                        class_month = datetime.strptime(c.date, "%Y-%m-%d").strftime("%Y-%m")
                    except:
                        class_month = datetime.strptime(c.date, "%d-%m-%Y").strftime("%Y-%m")

                    if class_month != month:
                        continue
                except:
                    continue

            student_obj = Student.query.get(c.student_id)
            if not student_obj:
                continue

            student = student_obj.name

            if not student:
                continue

            key = (student, c.subject)

            if key not in report:
                report[key] = {"total": 0, "present": 0, "absent": 0}

            report[key]["total"] += 1

            if c.attendance == "present":
                report[key]["present"] += 1
            else:
                report[key]["absent"] += 1

        result = []

        for (student, subject), data in report.items():

            total = data["total"]
            present = data["present"]

            percentage = (present / total * 100) if total > 0 else 0

            result.append({
                "student_id": student_obj.id,
                "student": student,
                "subject": subject,
                "total": total,
                "present": present,
                "absent": data["absent"],
                "percentage": round(percentage, 2)
            })

        return jsonify(result)

    except Exception as e:
        print("ERROR IN REPORT:", e)
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/teacher_attendance_report/<int:user_id>', methods=['GET'])
def teacher_attendance_report(user_id):

    from models import Class, Student, Teacher
    from datetime import datetime

    month = request.args.get("month")  # ✅ month filter

    # ✅ convert user → teacher
    teacher = Teacher.query.filter_by(user_id=user_id).first()

    if not teacher:
        return jsonify([])

    classes = Class.query.filter_by(teacher_id=teacher.id).all()

    report = {}

    for c in classes:

        # ✅ skip pending
        if c.attendance not in ["present", "absent"]:
            continue

        # ✅ month filter
        if month:
            try:
                class_month = datetime.strptime(c.date, "%Y-%m-%d").strftime("%Y-%m")
                if class_month != month:
                    continue
            except:
                continue

        student_obj = Student.query.get(c.student_id)

        if not student_obj:
            continue

        student = student_obj.name

        if not student:
            continue

        key = (student, c.subject)

        if key not in report:
            report[key] = {
                "total": 0,
                "present": 0,
                "absent": 0
            }

        report[key]["total"] += 1

        if c.attendance == "present":
            report[key]["present"] += 1
        else:
            report[key]["absent"] += 1

    result = []

    for (student, subject), data in report.items():

        total = data["total"]
        present = data["present"]

        percentage = (present / total * 100) if total > 0 else 0

        result.append({
            "student_id": student_obj.id,
            "student": student,
            "subject": subject,
            "total": total,
            "present": present,
            "absent": data["absent"],
            "percentage": round(percentage, 2)
        })

    return jsonify(result)

@auth_bp.route('/student_attendance_pdf/<int:student_id>', methods=['GET'])
def student_attendance_pdf(student_id):

    from models import Class, Student
    from flask import send_file, request
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from datetime import datetime
    import io
    from reportlab.platypus import Table

    # ✅ GET MONTH (optional)
    month = request.args.get("month")  # format: YYYY-MM

    student = Student.query.get(student_id)

    if not student:
        return jsonify({"error": "Student not found"}), 404

    classes = Class.query.filter_by(student_id=student_id).all()

    report = {}

    for c in classes:

        if c.attendance not in ["present", "absent"]:
            continue

        # ✅ MONTH FILTER
        if month:
            try:
                class_month = datetime.strptime(c.date, "%Y-%m-%d").strftime("%Y-%m")
                if class_month != month:
                    continue
            except:
                continue

        subject = c.subject

        if subject not in report:
            report[subject] = {"total": 0, "present": 0}

        report[subject]["total"] += 1

        if c.attendance == "present":
            report[subject]["present"] += 1

    # ✅ CREATE PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []

    styles = getSampleStyleSheet()

    # ✅ LOGO (place your logo in /static/logo.png)
    # ✅ HEADER WITH RIGHT-ALIGNED LOGO (FINAL FIX)

    from reportlab.platypus import Table

    logo_path = "static/logo.png"

    try:
        logo = Image(logo_path, width=180, height=90)  # ✅ proper size

        header_data = [
            ["", logo]
        ]

    except:
        header_data = [["", ""]]

    header_table = Table(header_data, colWidths=[400, 120])  # ✅ more control

    header_table.setStyle(TableStyle([
        ('ALIGN', (1,0), (1,0), 'RIGHT'),   # ✅ right align
        ('VALIGN', (1,0), (1,0), 'TOP'),
        ('LEFTPADDING', (1,0), (1,0), 0),
        ('RIGHTPADDING', (1,0), (1,0), 0),
    ]))

    elements.append(header_table)
    elements.append(Spacer(1, 20))  # ✅ spacing

    # ✅ TITLE
    title = "STUDENT ATTENDANCE REPORT"
    elements.append(Paragraph(title, styles['Title']))

    elements.append(Spacer(1, 10))

    # ✅ STUDENT NAME
    elements.append(Paragraph(f"<b>Student Name:</b> {student.name}", styles['Normal']))

    # ✅ MONTH + YEAR
    if month:
        month_name = datetime.strptime(month, "%Y-%m").strftime("%B %Y")
        elements.append(Paragraph(f"<b>Report Period:</b> {month_name}", styles['Normal']))

    elements.append(Spacer(1, 15))

    # ✅ TABLE DATA
    data = [["Subject", "Total", "Present", "Attendance %"]]

    total_all = 0
    present_all = 0

    for subject, val in report.items():

        total = val["total"]
        present = val["present"]

        percent = round((present / total) * 100) if total > 0 else 0

        data.append([subject, total, present, f"{percent}%"])

        total_all += total
        present_all += present

    overall = round((present_all / total_all) * 100) if total_all > 0 else 0

    data.append(["", "", "Overall", f"{overall}%"])

    # ✅ TABLE DESIGN
    table = Table(data)

    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR',(0,0),(-1,0),colors.white),
        ('GRID',(0,0),(-1,-1),1,colors.black),
        ('ALIGN',(1,1),(-1,-1),'CENTER')
    ]))

    elements.append(table)

    elements.append(Spacer(1, 20))

    # ✅ TEACHER REMARKS (STATIC FOR NOW)
    remark_text = ""

    if overall >= 85:
        remark_text = "Excellent performance. Keep up the good work."
    elif overall >= 75:
        remark_text = "Good performance. Minor improvement required."
    else:
        remark_text = "Needs improvement. Regular attendance is advised."

    elements.append(Paragraph("<b>Remarks:</b>", styles['Heading3']))
    elements.append(Spacer(1, 5))
    elements.append(Paragraph(remark_text, styles['Normal']))

    # ✅ FOOTER
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("*This is a system generated report.", styles['Normal']))

    doc.build(elements)

    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"{student.name}_attendance.pdf",
        mimetype='application/pdf'
    )

@auth_bp.route('/get_all_subjects', methods=['GET'])
def get_all_subjects():

    from models import Subject

    subjects = Subject.query.all()

    result = []

    for s in subjects:
        result.append({
            "name": s.name,
            "standard": s.standard.name if s.standard else ""
        })

    return jsonify(result)

@auth_bp.route('/change_password', methods=['POST'])
def change_password():

    from models import User
    from werkzeug.security import check_password_hash, generate_password_hash

    data = request.get_json()

    user_id = data.get("user_id")
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    user = User.query.get(user_id)

    if not user:
        return jsonify({"message": "User not found"}), 404

    # ✅ check current password
    if not check_password_hash(user.password, current_password):
        return jsonify({"message": "Current password is incorrect"}), 400

    # ✅ update password
    user.password = generate_password_hash(new_password)

    db.session.commit()

    return jsonify({"message": "Password updated successfully"})

@auth_bp.route('/restore_backup', methods=['POST'])
def restore_backup():

    import os
    import shutil
    from models import User

    data = request.get_json()

    filename = data.get("filename")
    user_id = data.get("user_id")   # ✅ GET USER

    user = User.query.get(user_id)

    # ✅ FIXED ADMIN CHECK
    if not user or "admin" not in user.role:
        return jsonify({"message": "Unauthorized"}), 403

    backup_path = os.path.join("backup", filename)

    if not os.path.exists(backup_path):
        return jsonify({"message": "Backup not found"}), 404

    shutil.copy(backup_path, "tuition_app.db")

    return jsonify({"message": "Backup restored successfully"})

@auth_bp.route('/list_backups', methods=['GET'])
def list_backups():

    import os
    from models import User
    from flask import request

    user_id = request.args.get("user_id")   # ✅ GET USER

    user = User.query.get(user_id)

    # ✅  ADMIN CHECK
    if not user or "admin" not in user.role:
        return jsonify({"message": "Unauthorized"}), 403

    files = os.listdir("backup")
    files.sort(reverse=True)

    return jsonify(files)

@auth_bp.route('/generate_fees', methods=['POST'])
def generate_fees():

    from models import Student, Fee
    from datetime import datetime, date
    from flask import jsonify

    today = datetime.now()
    current_month = today.strftime("%Y-%m")

    students = Student.query.all()

    created = 0

    for s in students:

        # ✅ check already exists
        exists = Fee.query.filter_by(
            student_id=s.id,
            month=current_month
        ).first()

        if exists:
            continue

        # ✅ calculate due date
        due_day = s.fee_due_day or 5
        due_date = date(today.year, today.month, min(due_day, 28))

        fee = Fee(
            student_id=s.id,
            month=current_month,
            amount=s.monthly_fee,
            due_date=due_date,
            status="pending"
        )

        db.session.add(fee)
        created += 1

    db.session.commit()

    return jsonify({
        "message": f"{created} fee records created"
    })

@auth_bp.route('/fees', methods=['GET'])
def get_fees():

    from models import Fee, Student
    from flask import request, jsonify

    month = request.args.get("month")   # YYYY-MM
    year = request.args.get("year")     # YYYY

    query = Fee.query.join(Student)

    if month:
        query = query.filter(Fee.month == month)

    elif year:
        query = query.filter(Fee.month.startswith(year))

    fees = query.all()

    result = []

    for f in fees:
        result.append({
            "id": f.id,
            "student": f.student.name,
            "student_id": f.student.id,
            "month": f.month,
            "amount": f.amount,
            "due_date": f.due_date.strftime("%Y-%m-%d"),
            "paid_on": f.paid_on.strftime("%Y-%m-%d") if f.paid_on else "",
            "reference_no": f.reference_no or "",
            "status": f.status
        })

    return jsonify(result)

@auth_bp.route('/pay_fee/<int:fee_id>', methods=['POST'])
def pay_fee(fee_id):

    from models import Fee
    from flask import request, jsonify
    from datetime import datetime

    data = request.json

    fee = Fee.query.get(fee_id)

    if not fee:
        return jsonify({"message": "Fee not found"}), 404

    try:
        paid_on = datetime.strptime(data.get("paid_on"), "%Y-%m-%d").date()
    except:
        return jsonify({"message": "Invalid date format"}), 400

    fee.paid_on = paid_on
    fee.reference_no = data.get("reference_no", "")
    fee.status = "paid"

    db.session.commit()

    return jsonify({"message": "Payment recorded successfully"})

@auth_bp.route('/fees_summary', methods=['GET'])
def fees_summary():

    from models import Fee
    from flask import request, jsonify

    month = request.args.get("month")
    year = request.args.get("year")

    query = Fee.query

    if month:
        query = query.filter(Fee.month == month)

    elif year:
        query = query.filter(Fee.month.startswith(year))

    fees = query.all()

    total_expected = sum(f.amount for f in fees)
    total_received = sum(f.amount for f in fees if f.status == "paid")
    total_pending = sum(f.amount for f in fees if f.status == "pending")

    return jsonify({
        "total_expected": total_expected,
        "total_received": total_received,
        "total_pending": total_pending
    })



# Temporary
@auth_bp.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{"id": u.id, "name": u.name, "username": u.username} for u in users])