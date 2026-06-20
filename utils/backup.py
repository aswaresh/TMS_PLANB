import os
import shutil
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DB_FILE = os.path.join(BASE_DIR, "instance", "db.sqlite3")
BACKUP_DIR = os.path.join(BASE_DIR, "backup")

MAX_BACKUPS = 20


def create_backup():

    if not os.path.exists(DB_FILE):
        print("⚠ DB file not found:", DB_FILE)
        return

    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_name = f"backup_{timestamp}.db"

    dest = os.path.join(BACKUP_DIR, backup_name)

    shutil.copy(DB_FILE, dest)

    print("✅ Backup created:", backup_name)

    # ✅ delete old backups
    backups = sorted(os.listdir(BACKUP_DIR))

    if len(backups) > MAX_BACKUPS:
        for old_file in backups[:len(backups) - MAX_BACKUPS]:
            os.remove(os.path.join(BACKUP_DIR, old_file))
            print("🗑 Deleted old backup:", old_file)