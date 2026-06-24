// ✅ SUBJECT FUNCTIONS FIRST (TOP)
let editingStudentId = null;
let editingTeacherId = null;

window.getDate = function(dayOffset) {
    const today = new Date();
    today.setDate(today.getDate() + dayOffset);
    return today.toISOString().split('T')[0];
};



window.createBackup = function() {

    fetch('/api/create_backup', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: localStorage.getItem("user_id")
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadBackups();   // ✅ refresh list
    })
    .catch(err => console.error(err));
};

window.restoreBackup = function() {

    const select = document.getElementById("backupList");

    if (!select || !select.value) {
        alert("Please select a backup file");
        return;
    }

    if (!confirm("⚠ This will overwrite current data. Continue?")) {
        return;
    }

    fetch('/api/restore_backup', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: select.value,
            user_id: localStorage.getItem("user_id")
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        location.reload();   // ✅ reload after restore
    })
    .catch(err => console.error(err));
};

window.loadBackups = function() {

    fetch('/api/list_backups?user_id=' + localStorage.getItem("user_id"))
    .then(res => res.json())
    .then(data => {

        const select = document.getElementById("backupList");

        if (!select) return;

        select.innerHTML = "";

        data.forEach(file => {
            let option = document.createElement("option");
            option.value = file;
            option.text = file;
            select.appendChild(option);
        });
    })
    .catch(err => console.error(err));
};

window.loadTeacherStats = function() {

    const teacherId = localStorage.getItem("teacher_id");

    const monthInput = document.getElementById("dashboardMonth");
    const month = monthInput?.value || new Date().toISOString().slice(0, 7);

    let url = `/api/teacher_stats/${teacherId}?month=${month}`;

    fetch(url)
    .then(res => res.json())
    .then(data => {

        const totalEl = document.getElementById("total");
        const completedEl = document.getElementById("completed");
        const pendingEl = document.getElementById("pending");
        const cancelledEl = document.getElementById("cancelled");

        if (totalEl) totalEl.innerText = data.total || 0;
        if (completedEl) completedEl.innerText = data.completed || 0;
        if (pendingEl) pendingEl.innerText = data.pending || 0;
        if (cancelledEl) cancelledEl.innerText = data.cancelled || 0;

    })
    .catch(err => {
        console.error("Teacher stats error:", err);
    });
};

window.toggleSidebar = function() {

    const sidebar = document.querySelector(".sidebar");

    sidebar.classList.toggle("active");
};

document.addEventListener("click", function(e) {

    const sidebar = document.querySelector(".sidebar");
    const toggle = document.querySelector(".menu-toggle");

    if (
        window.innerWidth <= 768 &&
        !sidebar.contains(e.target) &&
        !toggle.contains(e.target)
    ) {
        sidebar.classList.remove("active");
    }
});

window.changePassword = function() {

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;

    if (!currentPassword || !newPassword) {
        alert("Please fill all fields");
        return;
    }

    fetch('/api/change_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: localStorage.getItem("user_id"),
            current_password: currentPassword,
            new_password: newPassword
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw err; });
        }
        return res.json();
    })
    .then(data => {
        alert(data.message);

        // ✅ clear fields
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
    })
    .catch(err => {
        alert(err.message);
    });
};

window.loadTeacherCalendar = function() {

    const userId = localStorage.getItem("user_id");

    fetch(`/api/teacher_calendar/${userId}`)
    .then(res => res.json())
    .then(data => {
    
    console.log("Teacher Calendar called");    // ✅ Debug
    console.log("API DATA:", data);

        const today = new Date();
        const days = [];

        // ✅ next 7 days
        for (let i = 0; i < 7; i++) {

            let d = new Date();
            d.setDate(today.getDate() + i);

            let iso = d.toISOString().split('T')[0];
            days.push(iso);

            let formatted = formatDateWithDay(iso);
            let parts = formatted.split(" ");

            document.getElementById(`day-${i}`).innerHTML = `
                <div>
                    <div>${parts[0]}</div>
                    <div style="font-size:12px;">${parts.slice(1).join(" ")}</div>
                </div>
            `;
        }

        // ✅ dynamic time slots
        let timeSlots = [...new Set(data.map(c => c.time))];
        timeSlots.sort();

        let rows = "";

        timeSlots.forEach(time => {

            let shortTime = time.replace(" - ", "<br>");

            rows += `<tr>`;
            rows += `<td>${shortTime}</td>`;

            days.forEach(day => {

                let classes = data.filter(c =>
                    c.date === day && c.time === time
                );

                let cell = "";

                classes.forEach(c => {

                    let color = "#ffc107";

                    if (c.status === "completed") color = "#28a745";
                    else if (c.status === "cancelled") color = "#dc3545";
                    else if (c.status === "rescheduled") color = "#007bff";

                    let attendanceBadge = "";

                    if (c.attendance === "present") {
                        attendanceBadge = "✅";
                    } else if (c.attendance === "absent") {
                        attendanceBadge = "❌";
                    }

                    cell += `
                    <div onclick="openCalendarModal(
                        ${c.id},
                        \`${c.student}\`,
                        \`${c.subject}\`,
                        '${c.date}',
                        \`${c.time}\`,
                        '${c.attendance || "pending"}'
                    )"
                    style="
                        background:${color};
                        padding:6px;
                        margin-bottom:5px;
                        border-radius:6px;
                        color:white;
                        cursor:pointer;
                        font-size:13px;
                    ">
                        <b>${c.student}</b><br>
                        ${c.subject}<br>
                        ${attendanceBadge}
                    </div>
                    `;
                });

                rows += `<td>${cell}</td>`;
            });

            rows += `</tr>`;
        });

        document.getElementById("teacher-calendar-body").innerHTML = rows;
    });
};

window.loadCalendar = function() {

    fetch('/api/get_classes')
    .then(res => res.json())
    .then(data => {

        const today = new Date();

        const days = [];

        // ✅ Generate next 7 days
        for (let i = 0; i < 7; i++) {
            let d = new Date();
            d.setDate(today.getDate() + i);

            let iso = d.toISOString().split('T')[0];

            days.push(iso);

            let formatted = formatDateWithDay(iso);

            // ✅ Split into 2 lines
            let parts = formatted.split(" ");

            document.getElementById(`day-${i}`).innerHTML = `
                <div style="text-align:center;">
                    <div>${parts[0]}</div>
                    <div style="font-size:13px;">${parts.slice(1).join(" ")}</div>
                </div>
            `;
        }

        // ✅ Get dynamic time slots
        let timeSlots = [...new Set(data.map(c => c.time))];

        timeSlots.sort();

        let rows = "";

        timeSlots.forEach(time => {

            rows += `<tr>`;
            rows += `<td style="font-weight:bold;">${time}</td>`;

            days.forEach(day => {

                const classes = data.filter(c =>
                    c.date === day && c.time === time
                );

                let cellContent = "";

                classes.forEach(c => {

                    let color = "#ffc107"; // default scheduled

                    if (c.status === "completed") color = "#28a745";
                    else if (c.status === "cancelled") color = "#dc3545";
                    else if (c.status === "rescheduled") color = "#007bff";

                    cellContent += `
                    <div onclick="openCalendarModal(
                        ${c.id},
                        \'${c.student}\',
                        \'${c.subject}\',
                        '${c.date}',
                        \'${c.time}\',
                        '${c.attendance || "pending"}'
                    )"
                    style="
                        background:${color};
                        padding:6px;
                        margin-bottom:5px;
                        border-radius:6px;
                        color:white;
                        font-size:13px;
                        cursor:pointer;
                    ">
                        <b>${c.student}</b><br>
                        ${c.subject}<br>              
                        <div style="
                                font-size:11px;
                                background:rgba(0,0,0,0.2);
                                padding:2px 4px;
                                border-radius:4px;
                                margin:2px 0;
                                display:inline-block;
                            ">
                                👨 ${c.teacher}
                            </div>

                            <!-- ✅ Attendance Badge -->
                            <div style="font-size:11px;">
                                ${
                                    c.attendance === "present"
                                    ? "✅ Present"
                                    : c.attendance === "absent"
                                    ? "❌ Absent"
                                    : "🟠 Scheduled"
                                }

                        ${c.time}
                    </div>
                    `;
                });

                rows += `<td>${cellContent || ""}</td>`;
            });

            rows += `</tr>`;
        });

        document.getElementById("calendar-body").innerHTML = rows;
    });
};

let selectedClassId = null;

window.openCalendarModal = function(id, student, subject, date, time, attendance) {

    selectedClassId = id;
    attendance = attendance || "pending";
    document.getElementById("calStudent").value = student;
    document.getElementById("calSubject").value = subject;
    document.getElementById("calDate").value = date;
    document.getElementById("calTime").value = time;    
    document.getElementById("calAttendance").value =
        (attendance === "pending") ? "" : attendance;
    const today = new Date().toISOString().split("T")[0];

    if (date > today) {
        document.getElementById("calAttendance").disabled = true;
    } else {
        document.getElementById("calAttendance").disabled = false;
    }


    document.getElementById("calendarModal").style.display = "block";
};

window.closeCalendarModal = function() {
    document.getElementById("calendarModal").style.display = "none";
};

window.updateCalendarClass = function() {

    fetch(`/api/update_class/${selectedClassId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({
            date: document.getElementById("calDate").value,
            time: document.getElementById("calTime").value,
            subject: document.getElementById("calSubject").value
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        closeCalendarModal();
        loadCalendar(); // ✅ refresh
    });
};

window.cancelCalendarClass = function() {

    if (!confirm("Cancel this class?")) return;

    fetch(`/api/cancel_class/${selectedClassId}`, {
        method: 'PUT'
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        closeCalendarModal();
        loadCalendar();
    });
};


window.markAttendanceFromCalendar = function() {

    const status = document.getElementById("calAttendance").value;

    if (!status) {
        alert("Please select attendance");
        return;
    }

    fetch('/api/mark_attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({
            class_id: selectedClassId,
            attendance: status,
            user_id: localStorage.getItem("user_id")
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw err; });
        }
        return res.json();
    })
    .then(data => {
        alert(data.message);
        closeCalendarModal();
        loadCalendar(); // ✅ refresh calendar
    })
    .catch(err => {
        alert(err.message); // ✅ shows validation error
    });
};


window.loadAdminClasses = function() {

    fetch('/api/admin_classes')
    .then(res => res.json())
    .then(data => {

        let rows = "";

        data.forEach(c => {

            rows += `
            <tr>
                <td>${c.student}</td>
                <td>${c.teacher}</td>
                <td>${c.subject}</td>
                <td>${formatDateWithDay(c.date)}</td>
                <td>${c.time}</td>

                <td id="status-${c.class_id}">
                    ${c.attendance === "present"
                        ? '<span style="color:green;">Present</span>'
                        : c.attendance === "absent"
                        ? '<span style="color:red;">Absent</span>'
                        : '<span style="color:orange;">Pending</span>'
                    }
                </td>

                <td>
                    <select id="att-${c.class_id}">
                        <option value="">Select</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                    </select>

                    <button onclick="adminMarkAttendance(${c.class_id})">
                        Save
                    </button>
                </td>
            </tr>
            `;
        });

        document.getElementById("admin-class-table").innerHTML = rows;
    });
};


window.adminMarkAttendance = function(classId) {

    const select = document.getElementById(`att-${classId}`);
    const status = select.value;

    if (!status) {
        alert("Select attendance");
        return;
    }

    fetch('/api/mark_attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            class_id: classId,
            attendance: status,
            user_id: localStorage.getItem("user_id")   // ✅ admin user
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadAdminClasses(); // ✅ refresh
    });
};

function formatDateWithDay(dateStr) {

    const date = new Date(dateStr);

    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const dayName = dayNames[date.getDay()];

    return `${day}-${month}-${year} (${dayName})`;
}

window.showTab = function(tabId, btn) {

    const tabs = document.querySelectorAll(".tab-content");
    const buttons = document.querySelectorAll(".tab-btn");

    // ✅ hide all tabs
    tabs.forEach(t => {
        t.classList.remove("active");
    });

    // ✅ remove active button
    buttons.forEach(b => {
        b.classList.remove("active");
    });

    // ✅ show selected tab
    const activeTab = document.getElementById(tabId);
    activeTab.classList.add("active");

    // ✅ activate button
    btn.classList.add("active");
};

window.loadSubjectsFromStudent = function() {

    const studentSelect = document.getElementById("scheduleStudent");

    const selectedOption = studentSelect.selectedOptions[0];

    if (!selectedOption || !selectedOption.dataset.info) return;

    const student = JSON.parse(selectedOption.dataset.info);

    let options = `<option value="">Select Subject</option>`;

    student.subjects.forEach(sub => {
        options += `<option value="${sub}">${sub}</option>`;
    });

    document.getElementById("scheduleSubject").innerHTML = options;
};

window.filterTeachersBySubject = function() {

    const subject = document.getElementById("scheduleSubject").value;

    if (!subject) return;

    fetch('/api/get_teachers')
    .then(res => res.json())
    .then(data => {

        let options = `<option value="">Select Teacher</option>`;

        data.forEach(t => {

            if (t.subjects.includes(subject)) {
                options += `<option value="${t.id}">${t.name}</option>`;
            }
        });

        document.getElementById("scheduleTeacher").innerHTML = options;
    });
};



window.loadScheduleStudents = function() {

    fetch('/api/get_students')
    .then(res => res.json())
    .then(data => {

        let options = `<option value="">Select Student</option>`;

        data.forEach(s => {

            options += `
                <option value="${s.id}" data-info='${JSON.stringify(s)}'>
                    ${s.name}
                </option>
            `;
        });

        document.getElementById("scheduleStudent").innerHTML = options;
    });
};

window.createSchedule = function() {

    const studentId = document.getElementById("scheduleStudent").value;
    const teacherId = document.getElementById("scheduleTeacher").value;
    const subject = document.getElementById("scheduleSubject").value;
    // ✅ TIME LOGIC (START + END)
    let start = document.getElementById("startTime").value;
    let end = document.getElementById("endTime").value;

    // ✅ validation
    if (!start || !end) {
        alert("Please select start and end time");
        return;
    }

    if (start >= end) {
        alert("End time must be greater than start time");
        return;
    }

    // ✅ build final time string
    let time = `${start.trim()} - ${end.trim()}`;

    const days = [];

    document.querySelectorAll(".day-checkbox:checked").forEach(cb => {
        days.push(cb.value);
    });

    if (!studentId) {
        alert("Select student");
        return;
    }
    if (!subject) {
        alert("Select subject");
        return;
    }
    if (!teacherId) {
        alert("Select teacher");
        return;
    }
    if (days.length === 0) {
        alert("Select at least one day");
        return;
    }
    
    fetch('/api/add_schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            student_id: studentId,
            teacher_id: teacherId,
            subject: subject,
            days: days,
            time: time,
            is_recurring: document.getElementById("isRecurring").checked,
            is_online: document.getElementById("isOnlineClass")?.checked || false
        })
    })   
    .then(res => {
        if (!res.ok) return res.text().then(text => { throw new Error(text) });
        return res.json();
    })
    .then(data => {
        alert(data.message);
        loadClasses();
    })
    .catch(err => {
        alert(err.message);
    });

};

window.loadClasses = function(apiUrl = '/api/get_classes') {
    
    if (!document.getElementById("class-list")) return;

    fetch(apiUrl)
    .then(res => res.json())
    .then(data => {

        const month = document.getElementById("monthFilter")?.value;
        const search = document.getElementById("studentSearch")?.value?.toLowerCase() || "";

        let filtered = data;

        // ✅ SEARCH OVERRIDES MONTH
        if (search) {
            filtered = data.filter(c =>
                c.student.toLowerCase().includes(search)
            );
        } else if (month) {
            filtered = data.filter(c => c.date.startsWith(month));
        }

        // ✅ SORTING
        filtered.sort((a, b) => {

            const today = new Date().toISOString().split("T")[0];

            const order = {
                "scheduled": 1,
                "rescheduled": 1,
                "completed": 2,
                "cancelled": 3
            };

            if (a.date >= today && b.date < today) return -1;
            if (a.date < today && b.date >= today) return 1;

            if (order[a.status] !== order[b.status]) {
                return order[a.status] - order[b.status];
            }

            return a.date.localeCompare(b.date);
        });

        let rows = "";

        if (filtered.length === 0) {
            rows = `
                <tr>
                    <td colspan="7" style="text-align:center; color:#888; font-weight:bold;">
                        ${search ? "No matching student found" : "No data found for selected month"}
                    </td>
                </tr>
            `;
        } else {




        let shownRules = new Set();

        filtered.forEach(c => {

            let stopBtn = "";

            // ✅ STOP BUTTON
            if (
                c.is_recurring &&
                (c.status === "scheduled" || c.status === "rescheduled") &&
                c.rule_id &&
                !shownRules.has(c.rule_id)
            ) {
                stopBtn = `<button class="btn-stop" onclick="stopSchedule(${c.rule_id})">Stop</button>`;
                shownRules.add(c.rule_id);
            }

            rows += `
            <tr>
                <td>${c.student}</td>
                <td>${c.subject}</td>
                <td>${c.teacher}</td>
                <td>${formatDateWithDay(c.date)}</td>
                <td>${c.time}</td>

                <td>
                    ${c.status === "completed"
                        ? `<span style="color:green; font-weight:bold;">Completed</span>`
                        : c.status === "cancelled"
                        ? `<span style="color:red; font-weight:bold;">Cancelled</span>`
                        : c.status === "rescheduled"
                        ? `<span style="color:blue; font-weight:bold;">Rescheduled</span>`
                        : `<span style="color:orange; font-weight:bold;">Scheduled</span>`
                    }
                </td>

                <td>

                    ${(c.status === "scheduled" || c.status === "rescheduled")
                        ? `<button class="btn-cancel" onclick="cancelClass(${c.id})">Cancel</button>`
                        : c.status === "completed"
                        ? `<span style="color:green;">Completed</span>`
                        : c.status === "cancelled"
                        ? `<span style="color:red;">Cancelled</span>`
                        : ""
                    }

                    ${(c.status === "scheduled" || c.status === "rescheduled")
                        ? `<button class="btn-edit" onclick='editClass(${c.id}, "${c.date}", "${c.time}", "${c.subject}", "${c.teacher_id}", "${c.student_id}")'>Edit</button>`
                        : ""
                    }

                    ${stopBtn}

                </td>

            </tr>
            `;
        });
    }

        const tableBody = document.getElementById("class-list");

        if (tableBody) {
            tableBody.innerHTML = rows;
        }
    });
};

let editClassId = null;

window.editClass = function(id, date, time, subject, teacherId, studentId) {

    teacherId = parseInt(teacherId);
    studentId = parseInt(studentId);

    editClassId = id;

    // ✅ Set date
    document.getElementById("editDate").value = date;

    // ✅ SPLIT TIME INTO START + END
    if (time && time.includes("-")) {
        let parts = time.split("-");

        document.getElementById("editStartTime").value = parts[0].trim();
        document.getElementById("editEndTime").value = parts[1].trim();
    } else {
        // fallback safety
        document.getElementById("editStartTime").value = "";
        document.getElementById("editEndTime").value = "";
    }

    // ✅ LOAD TEACHERS
    fetch('/api/get_teachers')
    .then(res => res.json())
    .then(data => {

        let options = "";

        data.forEach(t => {
            options += `
                <option value="${t.id}" ${t.id == teacherId ? "selected" : ""}>
                    ${t.name}
                </option>
            `;
        });

        document.getElementById("editTeacher").innerHTML = options;
    });

    // ✅ LOAD SUBJECTS BASED ON STUDENT
    fetch('/api/get_students')
    .then(res => res.json())
    .then(data => {

        const student = data.find(s => s.id == studentId);

        let subjectOptions = "";

        if (student && student.subjects) {
            student.subjects.forEach(sub => {
                subjectOptions += `
                    <option value="${sub}" ${sub === subject ? "selected" : ""}>
                        ${sub}
                    </option>
                `;
            });
        }

        document.getElementById("editSubject").innerHTML = subjectOptions;
    });

    // ✅ SHOW MODAL
    document.getElementById("editModal").style.display = "block";
};


window.closeEdit = function() {
    document.getElementById("editModal").style.display = "none";
};

window.saveEdit = function() {

    const newDate = document.getElementById("editDate").value;

    const teacherId = parseInt(document.getElementById("editTeacher").value);
    const subject = document.getElementById("editSubject").value;

    // ✅ NEW TIME LOGIC (START + END)
    let start = document.getElementById("editStartTime").value;
    let end = document.getElementById("editEndTime").value;

    if (!start || !end) {
        alert("Please select start and end time");
        return;
    }

    if (start >= end) {
        alert("End time must be greater than start time");
        return;
    }

    let time = `${start.trim()} - ${end.trim()}`;

    // ✅ FIELD VALIDATION
    if (!newDate) {
        alert("Select date");
        return;
    }

    if (!subject) {
        alert("Select subject");
        return;
    }

    if (!teacherId) {
        alert("Select teacher");
        return;
    }

    // ✅ API CALL
    fetch(`/api/update_class/${editClassId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: newDate,
            time: time,
            teacher_id: teacherId,
            subject: subject
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw err; });
        }
        return res.json();
    })
    .then(data => {
        alert(data.message);
        closeEdit();
        loadClasses();
    })
    .catch(err => {
        alert(err.message);  // ✅ shows conflict / backend error
    });
};

window.cancelClass = function(id) {

    if (!confirm("Cancel this class?")) return;

    fetch(`/api/cancel_class/${id}`, {
        method: 'PUT'
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadClasses();  // ✅ refresh UI
    });
};

window.stopSchedule = function(id) {

    if (!confirm("Stop this recurring schedule?")) return;

    fetch(`/api/stop_schedule/${id}`, {
        method: 'PUT'
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);

        // ✅ Disable button immediately
        document.querySelectorAll(`button[onclick="stopSchedule(${id})"]`)
            .forEach(btn => {
                btn.disabled = true;
                btn.innerText = "Stopped";
                btn.style.backgroundColor = "#ccc";
                btn.style.cursor = "not-allowed";
            });

    });
};

window.addTeacher = function() {

    let subjects = [];

    
    document.querySelectorAll(".subject-checkbox:checked").forEach(cb => {
        subjects.push(cb.value);
    });

    if (subjects.length === 0) {
        alert("Please select at least one subject");
        return;
    }

    fetch('/api/add_teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({
            name: document.getElementById("teacherName").value.trim(),
            qualification: document.getElementById("qualification").value.trim(),
            experience: document.getElementById("experience").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            email: document.getElementById("email").value.trim(),
            // standard_id: document.getElementById("teacherStandard").value.trim(),
            subjects: subjects,

            username: document.getElementById("teacherUsername").value.trim(),
            password: document.getElementById("teacherPassword").value.trim(),
            role: document.getElementById("teacherRole").value
        })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw err; });
        }
        return res.json();
    })
    .then(data => {
        alert(data.message);

            // ✅ ✅ ADD THIS (FIX)
            loadTeachers();

            // ✅ OPTIONAL: clear form
            document.getElementById("teacherName").value = "";
            document.getElementById("qualification").value = "";
            document.getElementById("experience").value = "";
            document.getElementById("phone").value = "";
            document.getElementById("email").value = "";
            document.getElementById("teacherUsername").value = "";
            document.getElementById("teacherPassword").value = "";

            document.querySelectorAll(".subject-checkbox").forEach(cb => cb.checked = false);
        })
    .catch(err => {
        alert(err.message);   // ✅ shows "Username already exists"
    });

};

window.loadTeachers = function() {

    fetch('/api/get_teachers')
    .then(res => res.json())
    .then(data => {

        let rows = "";

        data.forEach(t => {

            rows += `
            <tr>
                <td>${t.name}</td>
                <td>${t.qualification}</td>
                <td>${t.experience}</td>
                <td>${t.subjects}</td>
                <td>${t.phone}</td>
                <td>${t.email}</td>
                <td>
                    <button onclick="editTeacher(${t.id})">Edit</button>
                    <button onclick="deleteTeacher(${t.id})" style="color:red;">Delete</button>
                </td>
            </tr>
            `;
        });

        document.getElementById("teacher-list").innerHTML = rows;
    });
};

window.deleteTeacher = function(id) {

    if (!confirm("Delete this teacher?")) return;

    fetch(`/api/delete_teacher/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadTeachers();
    });
};

window.editTeacher = function(id) {

    fetch('/api/get_teachers')
    .then(res => res.json())
    .then(data => {

        const t = data.find(x => x.id === id);
        if (!t) return;

        editingTeacherId = id;

        // ✅ Fill basic fields
        document.getElementById("teacherName").value = t.name;
        document.getElementById("qualification").value = t.qualification;
        document.getElementById("experience").value = t.experience;
        document.getElementById("phone").value = t.phone;
        document.getElementById("email").value = t.email;
        document.getElementById("teacherUsername").value = t.username;

        // ✅ Optional (keep if you still use it)
        document.getElementById("teacherStandard").value = t.standard_id;

        // ✅ Load all subjects first
        loadSubjectsForTeacher();

        // ✅ Convert CSV string → array
        let selectedSubjects = t.subjects ? t.subjects.split(",") : [];

        // ✅ Wait for checkboxes to render
        setTimeout(() => {

            document.querySelectorAll(".subject-checkbox").forEach(cb => {

                // ✅ MATCH USING VALUE (CORRECT WAY)
                if (selectedSubjects.includes(cb.value)) {
                    cb.checked = true;
                } else {
                    cb.checked = false;
                }

            });

            // ✅ OPTIONAL: sync "Select All"
            const all = document.querySelectorAll(".subject-checkbox");
            const checked = document.querySelectorAll(".subject-checkbox:checked");

            const selectAll = document.getElementById("selectAllSubjects");
            if (selectAll) {
                selectAll.checked = (all.length === checked.length);
            }

        }, 200);

        // ✅ Button toggle
        document.getElementById("addTeacherBtn").style.display = "none";
        document.getElementById("updateTeacherBtn").style.display = "inline-block";
    });
};


window.updateTeacher = function() {

    const subjects = [];

    document.querySelectorAll(".subject-checkbox:checked")
        .forEach(cb => subjects.push(cb.value));

    const passwordValue = document.getElementById("teacherPassword").value.trim();

    fetch(`/api/update_teacher/${editingTeacherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({
            name: document.getElementById("teacherName").value,
            qualification: document.getElementById("qualification").value,
            experience: document.getElementById("experience").value,
            phone: document.getElementById("phone").value,
            email: document.getElementById("email").value,
            standard_id: document.getElementById("teacherStandard").value,
            subjects: subjects,

            ...(passwordValue && { password: passwordValue })
        })
    })
    .then(res => res.json())
    .then(data => {

        alert(data.message);

        // ✅ Reset UI
        editingTeacherId = null;

        document.getElementById("addTeacherBtn").style.display = "inline-block";
        document.getElementById("updateTeacherBtn").style.display = "none";

        document.getElementById("teacherPassword").value = "";

        loadTeachers();
    });
};

function loadSubjectsForTeacher() {

    fetch('/api/get_all_subjects')
    .then(res => res.json())
    .then(data => {

        let grouped = {};

        // ✅ Group by standard
        data.forEach(sub => {
            if (!grouped[sub.standard]) {
                grouped[sub.standard] = [];
            }
            grouped[sub.standard].push(sub);
        });

        let html = "";

        // ✅ Select All
        html += `
        <div class="subject-item">
            <input type="checkbox" id="selectAllSubjects" onclick="toggleAllSubjects(this)">
            <label><b>Select All</b></label>
        </div>
        <hr>
        `;

        // ✅ Loop standards
        for (let standard in grouped) {

            html += `<div class="standard-group"><b>${standard}</b></div>`;

            grouped[standard].forEach(sub => {

                html += `
                <div class="subject-item">
                    <input type="checkbox" class="subject-checkbox"
                        value="${sub.name}"
                        id="sub-${standard}-${sub.name}">
                    <label for="sub-${standard}-${sub.name}">
                        ${sub.name}
                    </label>

                </div>
                `;
            });
        }

        document.getElementById("teacherSubjects").innerHTML = html;
    });
}



window.loadStudentStandards = function() {

    fetch('/api/get_standards')
    .then(res => res.json())
    .then(data => {

        let options = `<option value="">Select Standard</option>`;

        data.forEach(s => {
            options += `<option value="${s.id}">${s.name}</option>`;
        });

        document.getElementById("studentStandard").innerHTML = options;
    });
};

window.loadSubjectsForStudent = function() {

    const standardId = document.getElementById("studentStandard").value;

    if (!standardId) return Promise.resolve();

    return fetch(`/api/get_subjects?standard_id=${standardId}`)
    .then(res => res.json())
    .then(data => {

        let html = "";

        data.forEach(sub => {
           html += `
           <div class="subject-item">
               <input type="checkbox" class="subject-checkbox" value="${sub.id}" id="sub-${sub.id}">
               <label for="sub-${sub.id}">${sub.name}</label>
           </div>
           `;
        });

        document.getElementById("subjectCheckboxes").innerHTML = html;
    });
};

window.addStudent = function() {

    const subjectIds = [];

    document.querySelectorAll("#subjectCheckboxes input:checked")
    .forEach(cb => subjectIds.push(parseInt(cb.value)));

    fetch('/api/add_student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: document.getElementById("studentName").value,
            parent_name: document.getElementById("parentName").value,
            contact: document.getElementById("contact").value,
            standard_id: document.getElementById("studentStandard").value,
            subject_ids: subjectIds,
            monthly_fee: document.getElementById("fee").value,
            fee_due_day: document.getElementById("fee_due_day").value,
            username: document.getElementById("username").value,
            password: document.getElementById("password").value
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadStudents();
    });
};

window.loadStudents = function() {

    fetch('/api/get_students')
    .then(res => res.json())
    .then(data => {

        let rows = "";

        data.forEach(s => {

            rows += `
            <tr>
                <td>${s.name}</td>
                <td>${s.standard}</td>
                <td>${s.subjects.join(", ")}</td>
                <td>${s.parent}</td>
                <td>${s.contact}</td>
                <td>${s.fee}</td>
                <td>${s.fee_due_day || "-"}</td>
                <td>
                    <button onclick="editStudent(${s.id})">Edit</button>
                    <button onclick="deleteStudent(${s.id})" style="color:red;">Delete</button>
                </td>
            </tr>
            `;
        });

        document.getElementById("student-list").innerHTML = rows;
    });
};

window.deleteStudent = function(id) {

    if (!confirm("Are you sure you want to delete this student?")) {
        return;
    }

    fetch(`/api/delete_student/${id}`, {
        method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadStudents();
    });
};

window.editStudent = function(id) {

    fetch('/api/get_students')
    .then(res => res.json())
    .then(data => {

        const student = data.find(s => s.id === id);
        if (!student) return;

        editingStudentId = id;

        // ✅ Fill basic fields
        document.getElementById("studentName").value = student.name;
        document.getElementById("parentName").value = student.parent;
        document.getElementById("contact").value = student.contact;
        document.getElementById("fee").value = student.fee;
        document.getElementById("fee_due_day").value = student.fee_due_day || "";
        document.getElementById("username").value = student.username;

        // ✅ Set standard
        document.getElementById("studentStandard").value = student.standard_id;

        // ✅ Load subjects and THEN select
        loadSubjectsForStudent().then(() => {

            document.querySelectorAll("#subjectCheckboxes input")
            .forEach(cb => {

                const subjectName = cb.parentElement.textContent.trim();

                if (student.subjects.includes(subjectName)) {
                    cb.checked = true;
                }
            });

        });

        // ✅ Safe button handling
        const addBtn = document.getElementById("addBtn");
        const updateBtn = document.getElementById("updateBtn");
        const cancelBtn = document.getElementById("cancelBtn");

        if (addBtn) addBtn.style.display = "none";
        if (updateBtn) updateBtn.style.display = "inline-block";
        if (cancelBtn) cancelBtn.style.display = "inline-block";
    });
};

window.updateStudent = function() {

    const subjectIds = [];

    document.querySelectorAll("#subjectCheckboxes input:checked")
    .forEach(cb => subjectIds.push(parseInt(cb.value)));

    fetch(`/api/update_student/${editingStudentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: document.getElementById("studentName").value,
            parent_name: document.getElementById("parentName").value,
            contact: document.getElementById("contact").value,
            standard_id: document.getElementById("studentStandard").value,
            subject_ids: subjectIds,
            monthly_fee: document.getElementById("fee").value,
            fee_due_day: document.getElementById("fee_due_day").value,
            password: document.getElementById("password").value
        })
    })
    .then(res => res.json())
    .then(data => {

        alert(data.message);

        // ✅ Reset mode
        editingStudentId = null;

        document.getElementById("addBtn").style.display = "inline-block";
        document.getElementById("updateBtn").style.display = "none";

        // ✅ Clear form
        document.getElementById("studentName").value = "";
        document.getElementById("parentName").value = "";
        document.getElementById("contact").value = "";
        document.getElementById("fee").value = "";
        document.getElementById("subjectCheckboxes").innerHTML = "";

        loadStudents();
    });
};

window.addSubject = function() {

    const name = document.getElementById("subjectName").value;
    const standardId = document.getElementById("standardSelect").value;

    fetch('/api/add_subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name,
            standard_id: standardId
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);

        // ✅ REFRESH SUBJECT TABLE
        loadSubjects();
        if (document.getElementById("studentStandard").value) {
            loadSubjectsForStudent();
        }

        // ✅ REFRESH STUDENT SUBJECT CHECKBOXES (if same standard selected)
        const selectedStandard = document.getElementById("studentStandard")?.value;

        if (selectedStandard === standardId) {
            loadSubjectsForStudent();  // ✅ dynamic update
        }
    });
};


window.loadSubjects = function() {

    const standardId = document.getElementById("standardSelect").value;

    let url = "/api/get_subjects";

    if (standardId) {
        url += `?standard_id=${standardId}`;
    }

    fetch(url)
    .then(res => res.json())
    .then(data => {

        let rows = "";

        data.forEach(s => {

            rows += `
            <tr>
                <td>${s.standard}</td>
                <td>${s.name}</td>
                <td>
                    <button onclick="deleteSubject(${s.id})" style="color:red;">
                        Delete
                    </button>
                </td>
            </tr>
            `;
        });

        document.getElementById("subject-list").innerHTML = rows;
    });
};



window.deleteSubject = function(id) {

    if (!confirm("Are you sure you want to delete this subject?")) {
        return;
    }

    fetch(`/api/delete_subject/${id}`, {
        method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadSubjects();
    });
}

window.loadStandards = function() {

    fetch('/api/get_standards')
    .then(res => res.json())
    .then(data => {

        let options = `<option value="">Select Standard</option>`;

        data.forEach(s => {
            options += `<option value="${s.id}">${s.name}</option>`;
        });

        // ✅ student dropdown
        const studentStd = document.getElementById("studentStandard");
        if (studentStd) studentStd.innerHTML = options;

        // ✅ subject dropdown (admin)
        const subjectStd = document.getElementById("standardSelect");
        if (subjectStd) subjectStd.innerHTML = options;

        const teacherStd = document.getElementById("teacherStandard");
        if (teacherStd) teacherStd.innerHTML = options;
    });
};

window.addStandard = function() {

    const name = document.getElementById("standardName").value;

    fetch('/api/add_standard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadStandards();
        loadStudentStandards();
    });
};


window.logout = function() {

    // ✅ clear stored login data
    localStorage.removeItem("user_id");
    localStorage.removeItem("roles");
    localStorage.removeItem("name");

    // ✅ redirect to login page
    window.location.href = "/login";
};


window.updateAttendance = function(classId) {

    const select = document.getElementById(`att-${classId}`);
    const status = select.value;
    if (!status) {
        alert("Please select attendance before saving");
        return;
    }

    fetch('/api/mark_attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            class_id: classId,
            attendance: status,
            user_id: localStorage.getItem("user_id")
        })

    })
    .then(res => res.json())
    .then(data => {

        loadTeacherClasses();

        // ✅ UPDATE STATUS COLUMN LIVE
        document.getElementById(`status-${classId}`).innerHTML =
            status === "present"
            ? `<span style="color:green;">Present</span>`
            : status === "absent"
            ? `<span style="color:red;">Absent</span>`
            : `<span style="color:orange;">Pending</span>`;

        // ✅ LOCK dropdown
        select.disabled = true;

        // ✅ replace Save with Edit
        document.getElementById(`save-${classId}`).outerHTML =
            `<button onclick="enableEdit(${classId})" id="edit-${classId}">
                Edit
            </button>`;
    });
};

window.enableEdit = function(classId) {

    const select = document.getElementById(`att-${classId}`);

    // ✅ unlock dropdown
    select.disabled = false;

    // ✅ replace Edit with Save
    document.getElementById(`edit-${classId}`).outerHTML =
        `<button onclick="updateAttendance(${classId})" id="save-${classId}">
            Save
        </button>`;
};


window.markAttendance = function(classId, status) {
    fetch('/api/mark_attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: classId, attendance: status })
    })
    .then(res => res.json())
    .then(data => {

        let message = (status === 'pending') 
            ? "Updated for correction"
            : "Attendance marked";

        // ✅ show message
        alert(message);

        // ✅ update UI without reload
        const row = document.querySelector(`#row-${classId}`);

        if (row) {
            // update badge text
            const statusCell = row.querySelector(".status-cell");

            if (status === 'present') {
                statusCell.innerHTML = '<span class="badge badge-present">Present</span>';
            } else if (status === 'absent') {
                statusCell.innerHTML = '<span class="badge badge-absent">Absent</span>';
            } else {
                statusCell.innerHTML = '<span class="badge badge-pending">Pending</span>';
            }

            // update action column
            const actionCell = row.querySelector(".action-cell");

            if (status === 'pending') {
                actionCell.innerHTML = `
                    <button class="btn-present" onclick="markAttendance(${classId}, 'present')">Present</button>
                    <button class="btn-absent" onclick="markAttendance(${classId}, 'absent')">Absent</button>
                `;
            } else {
                actionCell.innerHTML = `
                    <button class="btn-edit" onclick="markAttendance(${classId}, 'pending')">Edit</button>
                `;
            }
        }
    });
};


window.payFee = function(feeId) {
    fetch('/api/pay_fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fee_id: feeId })
    })
    .then(res => res.json())
    .then(data => {

        alert("Fee marked as paid");

        const row = document.querySelector(`#fee-row-${feeId}`);

        if (row) {
            // ✅ update status badge
            const statusCell = row.querySelector(".fee-status-cell");
            statusCell.innerHTML = '<span class="badge badge-present">Paid</span>';

            // ✅ update action column
            const actionCell = row.querySelector(".fee-action-cell");
            actionCell.innerHTML = '<span style="color:#888;">Done</span>';
        }
    });
};


window.loadTeacherClasses = function() {

    const teacherId = localStorage.getItem("teacher_id");

    fetch(`/api/teacher_classes/${teacherId}`)
    .then(res => res.json())
    .then(data => {

        const month = document.getElementById("monthFilter")?.value
                    || new Date().toISOString().slice(0, 7);

        const search = document.getElementById("studentSearch")?.value?.toLowerCase() || "";

        let filtered = data;

        // ✅ search by subject
        if (search) {
            filtered = data.filter(c =>
                (c.subject || "").toLowerCase().includes(search)
            );
        }
        else if (month) {
            filtered = data.filter(c => c.date.startsWith(month));
        }

        let rows = "";

        // ✅ sorting (future first)
        filtered.sort((a, b) => {
            const today = new Date().toISOString().split("T")[0];
            if (a.date >= today && b.date < today) return -1;
            if (a.date < today && b.date >= today) return 1;
            return a.date.localeCompare(b.date);
        });

        filtered.forEach(c => {

            // ✅ CANCELLED CASE
            if (c.status === "cancelled") {
                rows += `
                <tr>
                    <td>${c.student}</td>
                    <td>${c.subject || "-"}</td>
                    <td>${formatDateWithDay(c.date)}</td>
                    <td>${c.time}</td>
                    <td colspan="2" style="color:red; font-weight:bold;">
                        Cancelled
                    </td>
                </tr>
                `;
                return;
            }

            // ✅ ZOOM BUTTON BLOCK (SAFE)
            let zoomButtons = "";

            if (c.is_online && c.start_url) {
                zoomButtons = `
                    <div style="display:flex; gap:10px;">
                        <button style="background:#28a745;color:white;border:none;padding:5px 10px;cursor:pointer;"
                            onclick="window.open('${c.start_url}', '_blank')">
                            ▶ Start
                        </button>

                        <button style="background:#6c757d;color:white;border:none;padding:5px 10px;cursor:pointer;"
                            onclick="navigator.clipboard.writeText('${c.join_url}')">
                            📋 Copy
                        </button>
                    </div>

                    <div style="font-size:11px;color:#888;">
                        ⚠ 40 min limit
                    </div>
                `;
            }

            rows += `
            <tr>
                <td>${c.student}</td>
                <td>${c.subject || "-"}</td>
                <td>${formatDateWithDay(c.date)}</td>
                <td>${c.time}</td>

                <!-- ✅ STATUS -->
                <td id="status-${c.class_id}">
                    ${
                        c.attendance === "present"
                        ? `<span style="color:green;">Present</span>`
                        : c.attendance === "absent"
                        ? `<span style="color:red;">Absent</span>`
                        : `<span style="color:orange;">Pending</span>`
                    }
                </td>

                <!-- ✅ ACTION -->
                <td style="display:flex; flex-direction:column; gap:6px;">

                    <!-- ✅ ATTENDANCE -->
                    <div style="display:flex; gap:10px;">
                        <select id="att-${c.class_id}" style="width:150px;" ${c.attendance !== "pending" ? "disabled" : ""}>
                            <option value="">Select Attendance</option>
                            <option value="present" ${c.attendance === "present" ? "selected" : ""}>Present</option>
                            <option value="absent" ${c.attendance === "absent" ? "selected" : ""}>Absent</option>
                        </select>

                        ${
                            c.attendance === "pending"
                            ? `<button onclick="updateAttendance(${c.class_id})">Save</button>`
                            : `<button onclick="enableEdit(${c.class_id})">Edit</button>`
                        }
                    </div>

                    <!-- ✅ ZOOM -->
                    ${zoomButtons}

                </td>
            </tr>
            `;
        });

        document.getElementById("class-table").innerHTML = rows;
    });
};

window.loadStudentClasses = function() {

    const studentId = localStorage.getItem("user_id");

    fetch(`/api/student_classes/${studentId}`)
    .then(res => res.json())
    .then(data => {

        const month = document.getElementById("classMonthFilter")?.value;
        const search = document.getElementById("studentSearch")?.value?.toLowerCase() || "";

        let filtered = data;

        // ✅ search by subject
        if (search) {
            filtered = data.filter(c =>
                (c.subject || "").toLowerCase().includes(search)
            );
        }
        else if (month) {
            filtered = data.filter(c => c.date.startsWith(month));
        }

        let rows = "";

        if (filtered.length === 0) {
            document.getElementById("student-table").innerHTML =
                "<tr><td colspan='4'>No classes assigned</td></tr>";
            return;
        }

        // ✅ sort by date
        filtered.sort((a, b) => a.date.localeCompare(b.date));

        filtered.forEach(c => {

            // ✅ JOIN BUTTON BLOCK (SAFE)
            let joinButton = "";

            if (c.is_online && c.join_url) {
                joinButton = `
                    <button style="background:#007bff;color:white;border:none;padding:5px 10px;cursor:pointer;"
                        onclick="window.open('${c.join_url}', '_blank')">
                        🔗 Join Class
                    </button>

                    <button style="background:#6c757d;color:white;border:none;padding:5px 10px;cursor:pointer;margin-left:8px;"
                        onclick="navigator.clipboard.writeText('${c.join_url}')">
                        📋 Copy
                    </button>

                    <div style="font-size:11px;color:#888;margin-top:3px;">
                        ⚠ 40 min limit
                    </div>
                `;
            }

            rows += `
            <tr>
                <td>${c.subject || "-"}</td>   
                <td>${formatDateWithDay(c.date)}</td>             
                <td>${c.time}</td>             

                <td>
                    ${
                        c.status === "present"
                        ? `<span style="color:green; font-weight:bold;">Present</span>`
                        : c.status === "absent"
                        ? `<span style="color:red; font-weight:bold;">Absent</span>`
                        : `<span style="color:orange; font-weight:bold;">Pending</span>`
                    }

                    <!-- ✅ ZOOM BUTTON -->
                    ${joinButton}
                </td>
            </tr>
            `;
        });

        document.getElementById("student-table").innerHTML = rows;
    });
};

window.createUser = function() {

    const name = document.getElementById("name").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    fetch('/api/create_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name,
            username: username,
            password: password,
            role: role
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
    })
    .catch(err => {
        console.error(err);
    });
};

window.loadAttendanceReport = function() {

    const container = document.getElementById("attendance-report");
    if (!container) return;

    const roles = localStorage.getItem("roles") || "";
    const userId = localStorage.getItem("user_id");

    let url = "";

    // ✅ ROLE BASED API
    if (roles.includes("admin")) {
        url = "/api/admin_attendance_report";
    } 
    else if (roles.includes("teacher")) {
        url = `/api/teacher_attendance_report/${userId}`;
    }
    else if (roles.includes("student")) {
        url = `/api/attendance_subject_summary/${userId}`;
    }

    // ✅ MONTH FILTER
    const monthInput = document.getElementById("reportMonth");
    const month = monthInput?.value || new Date().toISOString().slice(0, 7);

    url += `?month=${month}`;

    fetch(url)
    .then(res => res.json())
    .then(data => {

        container.innerHTML = "";

        // ✅ EMPTY CHECK
        if (!data || (Array.isArray(data) && data.length === 0)) {
            container.innerHTML = `
                <div style="padding:20px; color:#888; font-weight:bold;">
                    ⚠ No data available
                </div>
            `;
            return;
        }

        // ✅ CONVERT OBJECT → ARRAY (student case)
        if (!Array.isArray(data)) {
            data = Object.entries(data).map(([subject, val]) => ({
                subject: subject,
                total: val.total,
                present: val.present,
                absent: val.absent,
                percentage: val.percentage
            }));
        }

        // ✅ OVERALL %
        let totalAll = 0;
        let presentAll = 0;

        data.forEach(r => {
            totalAll += r.total;
            presentAll += r.present;
        });

        let overall = totalAll > 0 ? Math.round((presentAll / totalAll) * 100) : 0;

        // ✅ ✅ CARD RENDERING (OLD DESIGN RESTORED ✅)
        // ✅ ✅ GROUP BY STUDENT
let grouped = {};

data.forEach(r => {

    const student = r.student || "Unknown";

    if (!grouped[student]) {
        grouped[student] = {
            subjects: [],
            total: 0,
            present: 0
        };
    }

    grouped[student].subjects.push(r);

    grouped[student].total += r.total;
    grouped[student].present += r.present;
});


    // ✅ ✅ RENDER STUDENT CARDS
    container.innerHTML = "";

    Object.keys(grouped).forEach(student => {

        const g = grouped[student];

        const overallPercent = g.total > 0
            ? Math.round((g.present / g.total) * 100)
            : 0;

        let color = overallPercent < 75 ? "#e74c3c" : "#2ecc71";

        let subjectRows = "";

        // ✅ ✅ SUBJECT DETAILS (FINAL FORMAT ✅)
        g.subjects.forEach(sub => {

            subjectRows += `
            <div style="margin-bottom:10px; padding-left:8px; background: #f9f9f9; border-radius: 6px; padding: 6px; border-left:3px solid #ddd;">
    
                <div style="font-weight:bold; margin-bottom:2px;">
                    ${sub.subject}
                </div>

                <div style="font-size:13px;">
                    Total: ${sub.total}
                </div>

                <div style="font-size:13px; color:green;">
                    Present: ${sub.present}
                </div>

                <div style="font-size:13px; color:red;">
                    Absent: ${sub.absent}
                </div>

            </div>
            `;
        });

        container.innerHTML += `
        <div class="report-card">

            <h4>${student}</h4>

            ${subjectRows}

            <hr>

            <!-- ✅ OVERALL SUMMARY -->
            <p><b>Total Classes:</b> ${g.total}</p>
            <p><b>Present:</b> ${g.present}</p>

            <!-- ✅ PROGRESS BAR -->
            <div style="
                width:100%;
                background:#eee;
                height:10px;
                border-radius:5px;
                overflow:hidden;
                margin-top:8px;
            ">
                <div style="
                    width:${overallPercent}%;
                    background:${color};
                    height:10px;
                "></div>
            </div>

            <p style="
                font-size:13px;
                font-weight:bold;
                text-align:right;
                color:${color};
            ">
                Overall → ${overallPercent}%
            </p>

            <!-- ✅ PDF BUTTON -->
            ${g.subjects[0].student_id ? `
                <button class="btn-view"
                    onclick="downloadPDF(${g.subjects[0].student_id})">
                    📄 Download PDF
                </button>
            ` : ""}

        </div>
        `;
    });

    })
    .catch(err => {
        console.error("Attendance report error:", err);
    });
};

window.downloadPDF = function(studentId) {

    const monthInput = document.getElementById("reportMonth");
    const month = monthInput ? monthInput.value : "";

    // ✅ Base URL
    let url = `/api/student_attendance_pdf/${studentId}`;

    // ✅ Append month only if selected
    if (month && month.trim() !== "") {
        url += `?month=${encodeURIComponent(month)}`;
    }

    // ✅ Debug (optional, helps during testing)
    console.log("Downloading PDF:", url);

    // ✅ Open PDF
    window.open(url, "_blank");
};

window.toggleStudent = function(id) {

    let rows = document.querySelectorAll(`.student-${id}`);
    let arrow = document.getElementById(`arrow-${id}`);

    let isHidden = rows[0]?.style.display === "none";

    rows.forEach(row => {
        row.style.display = isHidden ? "" : "none";
    });

    // ✅ CHANGE ARROW
    arrow.innerText = isHidden ? "▼" : "▶";
};

window.toggleAllSubjects = function(source) {

    document.querySelectorAll(".subject-checkbox").forEach(cb => {
        cb.checked = source.checked;
    });
};

window.addEventListener("DOMContentLoaded", function() {
    
    const monthInput = document.getElementById("monthFilter");

    if (monthInput && !monthInput.value) {
        monthInput.value = new Date().toISOString().slice(0, 7);
    }

    if (document.getElementById("class-list")) {

        const path = window.location.pathname;

        if (path.includes("admin_schedule")) {
            loadClasses('/api/get_classes');
        }
    }


    if (document.getElementById("class-table")) {
        loadTeacherClasses();
    }

    if (document.getElementById("student-table")) {
        loadStudentClasses();
    }

    if (document.getElementById("attendance-report")) {
        loadAttendanceReport();
    }
    if (document.getElementById("subject-list")) {
        loadSubjects();
    }

    if (document.getElementById("standardSelect")) {
        loadStandards();
    }

    if (document.getElementById("subject-list")) {
        loadSubjects();
    }
    
    if (document.getElementById("studentStandard")) {
        loadStudentStandards();
    }

    if (document.getElementById("student-list")) {
        loadStudents();
    }

    if (document.getElementById("teacherStandard")) {
        loadStandards();
    }

    if (document.getElementById("teacher-list")) {
        loadTeachers();
    }
    if (document.getElementById("scheduleStudent")) {
        loadScheduleStudents();
    }


    if (document.getElementById("teacher-calendar-body")) {
        console.log("Triggering teacher calendar"); // ✅ debug
        loadTeacherCalendar();
    }
    const roles = localStorage.getItem("roles") || "";
    const backupSection = document.getElementById("backup-section");
    
    if (backupSection) {   // ✅ CHECK FIRST

        if (roles.includes("admin")) {
            backupSection.style.display = "block";
        } else {
            backupSection.style.display = "none";
        }

    }
    if (window.location.pathname === "/admin_backup") {
        loadBackups();   // ✅ load list automatically
    }
    
 
});


let logoutTimer;

// ✅ TIME (in milliseconds)
const AUTO_LOGOUT_TIME = 15 * 60 * 1000;  // 15 minutes

function resetLogoutTimer() {

    clearTimeout(logoutTimer);

    logoutTimer = setTimeout(() => {
        alert("Session expired. Logging out...");
        logout();
    }, AUTO_LOGOUT_TIME);
}

// ✅ TRACK USER ACTIVITY
["click", "mousemove", "keydown", "scroll"].forEach(event => {
    document.addEventListener(event, resetLogoutTimer);
});

// ✅ START TIMER ON PAGE LOAD
resetLogoutTimer();

