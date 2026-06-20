from utils.db import db
from sqlalchemy import JSON
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    username = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(200))
    role = db.Column(db.String)  # admin / student / teacher

class PendingStudent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    parent_name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    course = db.Column(db.String(100))
    username = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(200))
    status = db.Column(db.String(20), default="pending")

class Class(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer)
    teacher_id = db.Column(db.Integer)
    subject = db.Column(db.String(100))
    date = db.Column(db.String(20))
    time = db.Column(db.String(20))
    status = db.Column(db.String(20), default="scheduled")
    attendance = db.Column(db.String(20), default="pending")
    rule_id = db.Column(db.Integer)


class Fee(db.Model):
    __tablename__ = "fees"

    id = db.Column(db.Integer, primary_key=True)

    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)

    # ✅ YYYY-MM format
    month = db.Column(db.String(7), nullable=False, index=True)

    amount = db.Column(db.Float, nullable=False)

    due_date = db.Column(db.Date, nullable=False)

    # ✅ Manual payment date
    paid_on = db.Column(db.Date, nullable=True)

    reference_no = db.Column(db.String(100), nullable=True)

    remarks = db.Column(db.String(200), nullable=True)

    # ✅ pending / paid
    status = db.Column(db.String(20), default="pending")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

    # ✅ Prevent duplicate entries
    __table_args__ = (
        db.UniqueConstraint('student_id', 'month', name='unique_student_month'),
    )

    # ✅ Relationship
    student = db.relationship("Student", backref="fees")

class Standard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)


class Subject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    standard_id = db.Column(db.Integer, db.ForeignKey('standard.id'))

    standard = db.relationship('Standard', backref='subjects')

class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(100))
    parent_name = db.Column(db.String(100))
    contact = db.Column(db.String(20))

    standard_id = db.Column(db.Integer, db.ForeignKey('standard.id'))
    standard = db.relationship('Standard')

    monthly_fee = db.Column(db.Float)

    subjects = db.relationship('Subject', secondary='student_subject')

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    fee_due_day = db.Column(db.Integer)


# ✅ ASSOCIATION TABLE (OUTSIDE CLASS)
student_subject = db.Table('student_subject',
    db.Column('student_id', db.Integer, db.ForeignKey('student.id')),
    db.Column('subject_id', db.Integer, db.ForeignKey('subject.id'))
)


teacher_subject = db.Table('teacher_subject',
    db.Column('teacher_id', db.Integer, db.ForeignKey('teacher.id')),
    db.Column('subject_id', db.Integer, db.ForeignKey('subject.id'))
)

class Teacher(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(100))
    qualification = db.Column(db.String(100))
    experience = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))

    # ✅ standard relation (optional but useful later)
    standard_id = db.Column(db.Integer, db.ForeignKey('standard.id'))
    standard = db.relationship('Standard')

    # ✅ subjects (same as student)
    subjects = db.Column(db.String)

    # ✅ login link
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))


class ScheduleRule(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    student_id = db.Column(db.Integer, db.ForeignKey('student.id'))
    teacher_id = db.Column(db.Integer, db.ForeignKey('teacher.id'))

    subject = db.Column(db.String(100))

    days = db.Column(db.JSON)  # ["Monday", "Tuesday"]

    time = db.Column(db.String(20))

    is_recurring = db.Column(db.Boolean, default=True)

    status = db.Column(db.String(20), default="active")  # active / stopped


