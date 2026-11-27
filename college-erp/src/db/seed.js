// Seed the database with realistic demo data.
// Run with: node src/db/seed.js
const bcrypt = require('bcryptjs');
const { getDb } = require('./connection');
const { migrate } = require('./schema');

const AVATAR_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4'];

function hash(pw) { return bcrypt.hashSync(pw, 10); }
function pick(arr, i) { return arr[i % arr.length]; }
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

function seed() {
  migrate();
  const db = getDb();

  // Wrap whole seed in a transaction
  const seedAll = db.transaction(() => {
    // ===== DEPARTMENTS =====
    const deptStmt = db.prepare(`INSERT OR IGNORE INTO departments(code, name, hod_name, description) VALUES (?,?,?,?)`);
    const depts = [
      ['CSE','Computer Science & Engineering','Dr. Anjali Mehta','Software, systems, AI and data science'],
      ['ECE','Electronics & Communication','Dr. Rajesh Khanna','VLSI, signals, embedded systems'],
      ['ME','Mechanical Engineering','Dr. Sunita Rao','Thermodynamics, design, manufacturing'],
      ['BBA','Business Administration','Dr. Vikram Singh','Management, finance, marketing'],
      ['BSC','Basic Sciences','Dr. Priya Nair','Mathematics, physics, chemistry'],
    ];
    depts.forEach(d => deptStmt.run(...d));

    // ===== COURSES =====
    const courseStmt = db.prepare(`INSERT OR IGNORE INTO courses(code, name, department_id, duration_years, total_semesters, description) VALUES (?,?,?,?,?,?)`);
    const courses = [
      ['BTech-CSE','B.Tech — Computer Science & Engineering', 1, 4, 8, 'Four-year undergraduate engineering program in CSE'],
      ['BTech-ECE','B.Tech — Electronics & Communication', 2, 4, 8, 'Four-year undergraduate engineering program in ECE'],
      ['BTech-ME','B.Tech — Mechanical Engineering', 3, 4, 8, 'Four-year undergraduate engineering program in ME'],
      ['BCA','Bachelor of Computer Applications', 1, 3, 6, 'Three-year program in computer applications'],
      ['BBA','Bachelor of Business Administration', 4, 3, 6, 'Three-year management program'],
      ['MCA','Master of Computer Applications', 1, 2, 4, 'Two-year postgraduate program'],
    ];
    courses.forEach(c => courseStmt.run(...c));

    // ===== SUBJECTS =====
    const subjStmt = db.prepare(`INSERT OR IGNORE INTO subjects(code, name, department_id, credits, semester) VALUES (?,?,?,?,?)`);
    const subjects = [
      // CSE
      ['CS101','Programming in C', 1, 4, 1],
      ['CS102','Data Structures', 1, 4, 2],
      ['CS201','Object Oriented Programming', 1, 4, 3],
      ['CS202','Database Management Systems', 1, 4, 3],
      ['CS203','Operating Systems', 1, 3, 4],
      ['CS301','Computer Networks', 1, 3, 5],
      ['CS302','Software Engineering', 1, 3, 5],
      ['CS303','Theory of Computation', 1, 3, 5],
      ['CS304','Artificial Intelligence', 1, 4, 6],
      ['CS305','Machine Learning', 1, 4, 7],
      ['CS306','Cloud Computing', 1, 3, 7],
      ['CS401','Big Data Analytics', 1, 4, 8],
      ['CS402','Cybersecurity', 1, 3, 8],
      // ECE
      ['EC101','Circuit Theory', 2, 4, 1],
      ['EC102','Digital Electronics', 2, 4, 2],
      ['EC201','Signals & Systems', 2, 4, 3],
      ['EC202','Microprocessors', 2, 3, 4],
      // ME
      ['ME101','Engineering Mechanics', 3, 4, 1],
      ['ME102','Thermodynamics', 3, 4, 2],
      ['ME201','Fluid Mechanics', 3, 4, 3],
      // BBA
      ['BA101','Principles of Management', 4, 3, 1],
      ['BA102','Financial Accounting', 4, 3, 2],
      ['BA201','Marketing Management', 4, 3, 3],
      // Maths / Science
      ['MA101','Engineering Mathematics I', 5, 4, 1],
      ['MA102','Engineering Mathematics II', 5, 4, 2],
      ['PH101','Engineering Physics', 5, 3, 1],
    ];
    subjects.forEach(s => subjStmt.run(...s));

    // ===== ADMIN USER =====
    const adminU = process.env.ADMIN_USERNAME || 'admin';
    const adminP = process.env.ADMIN_PASSWORD || 'admin123';
    const adminE = process.env.ADMIN_EMAIL || 'admin@college.edu';
    db.prepare(`INSERT OR IGNORE INTO users(username, email, password_hash, role, full_name, phone, avatar_color) VALUES (?,?,?,?,?,?,?)`)
      .run(adminU, adminE, hash(adminP), 'admin', 'System Administrator', '+91-9876543210', '#6366f1');

    // ===== TEACHERS =====
    const teacherUsers = [
      ['prof.sharma','prof.sharma@college.edu','teacher123','teacher','Prof. Arvind Sharma','CSE','Professor','Ph.D. Computer Science','Distributed Systems', 1, 18, 185000],
      ['prof.verma','prof.verma@college.edu','teacher123','teacher','Prof. Neha Verma','CSE','Associate Professor','Ph.D. Information Systems','Database Systems', 1, 12, 145000],
      ['prof.iyer','prof.iyer@college.edu','teacher123','teacher','Dr. Karthik Iyer','ECE','Assistant Professor','Ph.D. Electronics','VLSI Design', 2, 8, 125000],
      ['prof.gupta','prof.gupta@college.edu','teacher123','teacher','Dr. Meera Gupta','ME','Assistant Professor','Ph.D. Mechanical','Thermal Engineering', 3, 6, 120000],
      ['prof.khan','prof.khan@college.edu','teacher123','teacher','Dr. Imran Khan','BBA','Associate Professor','Ph.D. Management','Marketing Strategy', 4, 10, 140000],
      ['prof.nair','prof.nair@college.edu','teacher123','teacher','Prof. Latha Nair','BSC','Professor','Ph.D. Mathematics','Applied Mathematics', 5, 20, 165000],
    ];
    const teacherStmt = db.prepare(`INSERT INTO users(username, email, password_hash, role, full_name, phone, avatar_color) VALUES (?,?,?,?,?,?,?)`);
    const teacherExt = db.prepare(`INSERT INTO teachers(user_id, employee_id, department_id, designation, qualification, specialization, join_date, salary, experience_years) VALUES (?,?,?,?,?,?,?,?,?)`);
    teacherUsers.forEach((t, i) => {
      const [username, email, pw, role, fullName, deptCode, designation, qualification, specialization, deptId, exp, salary] = t;
      const res = teacherStmt.run(username, email, hash(pw), role, fullName, '+91-9876500'+(100+i), pick(AVATAR_COLORS, i+1));
      teacherExt.run(res.lastInsertRowid, 'EMP'+String(1001+i), deptId, designation, qualification, specialization, dateOffset(-365*exp), salary, exp);
    });

    // ===== CLASSES =====
    // CSE Semester 3 Section A
    const cseId = db.prepare('SELECT id FROM courses WHERE code=?').get('BTech-CSE').id;
    const eceId = db.prepare('SELECT id FROM courses WHERE code=?').get('BTech-ECE').id;
    const meId  = db.prepare('SELECT id FROM courses WHERE code=?').get('BTech-ME').id;
    const bbaId = db.prepare('SELECT id FROM courses WHERE code=?').get('BBA').id;

    const classStmt = db.prepare(`INSERT INTO classes(name, course_id, semester, section, class_teacher_id, room, academic_year, capacity) VALUES (?,?,?,?,?,?,?,?)`);
    const teacherRow = (empId) => db.prepare('SELECT id FROM teachers WHERE employee_id=?').get(empId);

    const cse3A = classStmt.run('BTech-CSE Sem 3 — Section A', cseId, 3, 'A', teacherRow('EMP1001').id, 'A-301', '2026-2027', 60);
    const cse3B = classStmt.run('BTech-CSE Sem 3 — Section B', cseId, 3, 'B', teacherRow('EMP1002').id, 'A-302', '2026-2027', 60);
    const ece3A = classStmt.run('BTech-ECE Sem 3 — Section A', eceId, 3, 'A', teacherRow('EMP1003').id, 'B-201', '2026-2027', 55);
    const me2A  = classStmt.run('BTech-ME Sem 2 — Section A',  meId, 2, 'A', teacherRow('EMP1004').id, 'C-105', '2026-2027', 60);
    const bba2A = classStmt.run('BBA Sem 2 — Section A', bbaId, 2, 'A', teacherRow('EMP1005').id, 'D-101', '2026-2027', 50);

    // ===== CLASS_SUBJECTS =====
    const csStmt = db.prepare(`INSERT INTO class_subjects(class_id, subject_id, teacher_id) VALUES (?,?,?)`);
    const subjByCode = (code) => db.prepare('SELECT id FROM subjects WHERE code=?').get(code).id;
    const teacherByEmp = (empId) => teacherRow(empId).id;

    // CSE Sem 3 Section A subjects
    [
      [cse3A.lastInsertRowid, 'CS201', 'EMP1001'],
      [cse3A.lastInsertRowid, 'CS202', 'EMP1002'],
      [cse3A.lastInsertRowid, 'MA102', 'EMP1006'],
    ].forEach(([cid, scode, emp]) => csStmt.run(cid, subjByCode(scode), teacherByEmp(emp)));

    [
      [cse3B.lastInsertRowid, 'CS201', 'EMP1001'],
      [cse3B.lastInsertRowid, 'CS202', 'EMP1002'],
    ].forEach(([cid, scode, emp]) => csStmt.run(cid, subjByCode(scode), teacherByEmp(emp)));

    [
      [ece3A.lastInsertRowid, 'EC201', 'EMP1003'],
    ].forEach(([cid, scode, emp]) => csStmt.run(cid, subjByCode(scode), teacherByEmp(emp)));

    [
      [me2A.lastInsertRowid, 'ME102', 'EMP1004'],
    ].forEach(([cid, scode, emp]) => csStmt.run(cid, subjByCode(scode), teacherByEmp(emp)));

    [
      [bba2A.lastInsertRowid, 'BA102', 'EMP1005'],
    ].forEach(([cid, scode, emp]) => csStmt.run(cid, subjByCode(scode), teacherByEmp(emp)));

    // ===== STUDENTS (40 students) =====
    const firstNames = ['Aarav','Diya','Arjun','Saanvi','Vivaan','Ananya','Reyansh','Ishita','Advait','Myra','Kabir','Aadhya','Vihaan','Pari','Arnav','Anika','Sai','Riya','Aryan','Sara','Dhruv','Kiara','Rohan','Tara','Krish','Mira','Yash','Zoya','Ved','Naina','Ayaan','Aisha','Reyansh','Diya','Kiaan','Avni','Shaurya','Anvi','Atharva','Navya'];
    const lastNames = ['Sharma','Reddy','Patel','Iyer','Khan','Gupta','Singh','Nair','Das','Rao','Verma','Joshi','Mehta','Pillai','Bose','Chopra','Khanna','Malhotra','Agarwal','Kapoor'];
    const studentUserStmt = db.prepare(`INSERT INTO users(username, email, password_hash, role, full_name, phone, avatar_color) VALUES (?,?,?,?,?,?,?)`);
    const studentStmt = db.prepare(`INSERT INTO students(user_id, roll_number, course_id, department_id, current_semester, current_section, admission_date, batch_year, guardian_name, guardian_phone, address, blood_group, gender, dob) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const enrollStmt = db.prepare(`INSERT OR IGNORE INTO class_students(class_id, student_id) VALUES (?,?)`);

    const bloodGroups = ['A+','B+','O+','AB+','A-','B-','O-'];
    const genders = ['Male','Female'];
    const cities = ['Bengaluru','Mysuru','Mumbai','Pune','Hyderabad','Chennai','Delhi','Kolkata'];

    const studentClassAssignments = [
      {classId: cse3A.lastInsertRowid, courseId: cseId, deptId: 1, sem: 3, section: 'A', rollPrefix: 'CSE21A'},
      {classId: cse3B.lastInsertRowid, courseId: cseId, deptId: 1, sem: 3, section: 'B', rollPrefix: 'CSE21B'},
      {classId: ece3A.lastInsertRowid, courseId: eceId, deptId: 2, sem: 3, section: 'A', rollPrefix: 'ECE21A'},
      {classId: me2A.lastInsertRowid, courseId: meId, deptId: 3, sem: 2, section: 'A', rollPrefix: 'ME22A'},
      {classId: bba2A.lastInsertRowid, courseId: bbaId, deptId: 4, sem: 2, section: 'A', rollPrefix: 'BBA22A'},
    ];

    let studentCounter = 0;
    const totalStudents = 40;
    for (let i = 0; i < totalStudents; i++) {
      const assign = studentClassAssignments[i % studentClassAssignments.length];
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[i % lastNames.length];
      const fullName = `${fn} ${ln}`;
      const username = (fn.toLowerCase() + '.' + ln.toLowerCase() + (i+1)).replace(/[^a-z.0-9]/g,'');
      const email = `${username}@student.college.edu`;
      const roll = `${assign.rollPrefix}${String(i+1).padStart(3,'0')}`;
      const userRes = studentUserStmt.run(username, email, hash('student123'), 'student', fullName, '+91-90000'+String(10000+i), pick(AVATAR_COLORS, i));
      const studentId = studentStmt.run(
        userRes.lastInsertRowid, roll, assign.courseId, assign.deptId, assign.sem, assign.section,
        dateOffset(-365*2), 2022, `${lastNames[i % lastNames.length]} (Guardian)`, '+91-90001'+String(10000+i),
        `${cities[i % cities.length]}, India`, pick(bloodGroups, i), pick(genders, i), dateOffset(-7000-i*30)
      ).lastInsertRowid;
      enrollStmt.run(assign.classId, studentId);
      studentCounter++;
    }

    // ===== FEE STRUCTURES =====
    const feeStmt = db.prepare(`INSERT OR IGNORE INTO fee_structures(course_id, semester, tuition_fee, library_fee, lab_fee, examination_fee, other_fee, academic_year) VALUES (?,?,?,?,?,?,?,?)`);
    for (let cId of [cseId, eceId, meId, bbaId]) {
      for (let s = 1; s <= 4; s++) {
        feeStmt.run(cId, s, 75000, 5000, 10000, 3000, 2000, '2026-2027');
      }
    }

    // ===== FEE INVOICES for current semester students =====
    const invoiceStmt = db.prepare(`INSERT INTO fee_invoices(invoice_number, student_id, semester, academic_year, total_amount, paid_amount, due_date, status) VALUES (?,?,?,?,?,?,?,?)`);
    const paymentStmt = db.prepare(`INSERT INTO payments(invoice_id, student_id, amount, payment_method, transaction_id, recorded_by) VALUES (?,?,?,?,?,?)`);
    const students = db.prepare(`SELECT id, current_semester, course_id FROM students`).all();
    let invCounter = 1000;
    students.forEach((st, idx) => {
      const fs = db.prepare(`SELECT * FROM fee_structures WHERE course_id=? AND semester=? AND academic_year='2026-2027'`).get(st.course_id, st.current_semester);
      const total = fs ? (fs.tuition_fee + fs.library_fee + fs.lab_fee + fs.examination_fee + fs.other_fee) : 95000;
      const invNo = 'INV-' + (++invCounter);
      // 70% paid, 15% partially paid, 15% unpaid
      let paid = 0, status = 'unpaid';
      const r = idx % 20;
      if (r < 14) { paid = total; status = 'paid'; }
      else if (r < 17) { paid = Math.round(total * 0.5); status = 'partially_paid'; }
      else { paid = 0; status = 'unpaid'; }
      const dueDate = dateOffset(-30 + (idx % 60));
      const inv = invoiceStmt.run(invNo, st.id, st.current_semester, '2026-2027', total, paid, dueDate, status);
      if (paid > 0) {
        paymentStmt.run(inv.lastInsertRowid, st.id, paid, 'Online Banking', 'TXN'+String(900000+idx), 1);
      }
    });

    // ===== ATTENDANCE (last 30 days, for CSE3A) =====
    const attStmt = db.prepare(`INSERT OR IGNORE INTO attendance(class_id, subject_id, student_id, date, status, marked_by) VALUES (?,?,?,?,?,?)`);
    const cse3AStudents = db.prepare(`SELECT student_id FROM class_students WHERE class_id=?`).all(cse3A.lastInsertRowid);
    const cse3ASubjects = db.prepare(`SELECT subject_id, teacher_id FROM class_subjects WHERE class_id=?`).all(cse3A.lastInsertRowid);
    const teacherUserId = (empId) => db.prepare('SELECT user_id FROM teachers WHERE employee_id=?').get(empId).user_id;
    for (let d = 0; d < 30; d++) {
      const dateStr = dateOffset(-d);
      const dow = new Date(dateStr).getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      cse3ASubjects.forEach(sub => {
        cse3AStudents.forEach(es => {
          const r = Math.random();
          let status = 'present';
          if (r < 0.08) status = 'absent';
          else if (r < 0.13) status = 'late';
          attStmt.run(cse3A.lastInsertRowid, sub.subject_id, es.student_id, dateStr, status, sub.teacher_id);
        });
      });
    }

    // ===== EXAMINATIONS + RESULTS for CSE3A =====
    const examStmt = db.prepare(`INSERT INTO examinations(name, exam_type, class_id, subject_id, total_marks, passing_marks, exam_date, academic_year, created_by) VALUES (?,?,?,?,?,?,?,?,?)`);
    const resultStmt = db.prepare(`INSERT OR IGNORE INTO results(examination_id, student_id, marks_obtained, grade, remarks, created_by) VALUES (?,?,?,?,?,?)`);
    cse3ASubjects.forEach(sub => {
      const examRes = examStmt.run('Midterm Examination', 'midterm', cse3A.lastInsertRowid, sub.subject_id, 100, 40, dateOffset(-10), '2026-2027', teacherUserId('EMP1001'));
      cse3AStudents.forEach(es => {
        const marks = Math.round(45 + Math.random() * 50); // 45-95
        let grade = 'F';
        if (marks >= 90) grade = 'A+';
        else if (marks >= 80) grade = 'A';
        else if (marks >= 70) grade = 'B+';
        else if (marks >= 60) grade = 'B';
        else if (marks >= 50) grade = 'C';
        else if (marks >= 40) grade = 'D';
        resultStmt.run(examRes.lastInsertRowid, es.student_id, marks, grade, grade === 'F' ? 'Needs improvement' : 'Good performance', teacherUserId('EMP1001'));
      });
    });

    // ===== TIMETABLE for CSE3A =====
    const ttStmt = db.prepare(`INSERT INTO timetable(class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room) VALUES (?,?,?,?,?,?,?)`);
    const cse3ASubjectsList = cse3ASubjects; // [{subject_id, teacher_id}]
    const slots = [['09:00','10:00'],['10:00','11:00'],['11:15','12:15'],['12:15','13:15'],['14:00','15:00'],['15:00','16:00']];
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    days.forEach((day, di) => {
      slots.forEach((slot, si) => {
        if (si === 3) return; // lunch slot empty
        const sub = cse3ASubjectsList[(di + si) % cse3ASubjectsList.length];
        ttStmt.run(cse3A.lastInsertRowid, sub.subject_id, sub.teacher_id, day, slot[0], slot[1], 'A-301');
      });
    });

    // ===== NOTICES =====
    const noticeStmt = db.prepare(`INSERT INTO notices(title, content, category, target_audience, priority, posted_by, is_pinned, expires_at) VALUES (?,?,?,?,?,?,?,?)`);
    const adminId = db.prepare("SELECT id FROM users WHERE role='admin'").get().id;
    const notices = [
      ['Welcome to Academic Year 2026-2027','We are delighted to welcome all students and faculty to a new academic year. Classes commence on November 24, 2026.','general','all','high',1],
      ['Mid-Semester Examinations Schedule','The mid-semester examinations will be conducted from December 5 to December 12, 2026. Detailed timetables have been sent to your respective class teachers.','exam','all','urgent',1],
      ['Annual Technical Fest "Innovate 2027"','Registrations are now open for our annual technical fest. Over 25 events across departments. Last date to register: December 20, 2026.','event','all','normal',0],
      ['Fee Payment Reminder — Semester 3','This is a reminder that the third installment of semester fees is due by November 30, 2026. Late payments will incur a penalty.','fee','student','high',0],
      ['Faculty Development Program','A 3-day FDP on "AI in Education" will be conducted for all teaching staff from December 1-3, 2026.','general','teacher','normal',0],
      ['Library Hours Extended','The central library will remain open till 10 PM during examination weeks for the convenience of students.','general','all','low',0],
    ];
    notices.forEach(n => {
      const [title, content, category, audience, priority, isPinned] = n;
      noticeStmt.run(title, content, category, audience, priority, adminId, isPinned, null);
    });

    // ===== STUDY MATERIALS =====
    const matStmt = db.prepare(`INSERT INTO study_materials(title, description, subject_id, class_id, uploaded_by, material_type, file_url, file_size) VALUES (?,?,?,?,?,?,?,?)`);
    const profSharma = teacherUserId('EMP1001');
    const profVerma = teacherUserId('EMP1002');
    const materials = [
      ['OOP Concepts — Lecture Notes','Comprehensive notes covering encapsulation, inheritance, polymorphism and abstraction with Java examples.', subjByCode('CS201'), cse3A.lastInsertRowid, profSharma, 'document', '/materials/oop-notes.pdf', 2400000],
      ['DBMS Lab Manual','Step-by-step lab exercises for SQL, normalization and transaction management.', subjByCode('CS202'), cse3A.lastInsertRowid, profVerma, 'document', '/materials/dbms-lab.pdf', 1800000],
      ['Data Structures — Video Lectures','Curated playlist of video lectures covering trees, graphs and complexity analysis.', subjByCode('CS201'), cse3A.lastInsertRowid, profSharma, 'video', '/materials/ds-videos.html', 0],
      ['Midterm Previous Year Papers','Solved previous year midterm papers for practice.', subjByCode('CS202'), cse3A.lastInsertRowid, profVerma, 'document', '/materials/pyq-midterm.pdf', 950000],
    ];
    materials.forEach(m => matStmt.run(...m));

    // ===== ASSIGNMENTS =====
    const assignStmt = db.prepare(`INSERT INTO assignments(title, description, class_id, subject_id, teacher_id, due_date, total_marks) VALUES (?,?,?,?,?,?,?)`);
    assignStmt.run('OOP Implementation Assignment','Implement a small banking system in Java demonstrating inheritance and polymorphism. Submit a PDF of source code and a 1-page write-up.', cse3A.lastInsertRowid, subjByCode('CS201'), teacherByEmp('EMP1001'), dateOffset(7), 50);
    assignStmt.run('SQL Normalization Exercise','Normalize the given unnormalized table to 3NF. Provide step-by-step justification.', cse3A.lastInsertRowid, subjByCode('CS202'), teacherByEmp('EMP1002'), dateOffset(10), 30);

    // ===== NOTIFICATIONS =====
    const notifStmt = db.prepare(`INSERT INTO notifications(user_id, title, message, type, link) VALUES (?,?,?,?,?)`);
    // notify all students about exam
    const allStudents = db.prepare('SELECT user_id FROM students').all();
    allStudents.forEach(s => {
      notifStmt.run(s.user_id, 'Mid-Semester Examinations', 'Your midterm examinations begin on December 5. Check the timetable on your dashboard.', 'announcement', '/student/examinations');
    });
    // notify some about fee
    const unpaidStudents = db.prepare(`SELECT DISTINCT s.user_id FROM fee_invoices fi JOIN students s ON s.id = fi.student_id WHERE fi.status != 'paid'`).all();
    unpaidStudents.forEach(s => {
      notifStmt.run(s.user_id, 'Fee Payment Due', 'Your semester fee is pending. Please complete payment before November 30 to avoid late penalty.', 'warning', '/student/fees');
    });
    // notify teachers
    const allTeachers = db.prepare('SELECT user_id FROM teachers').all();
    allTeachers.forEach(t => {
      notifStmt.run(t.user_id, 'Faculty Development Program', 'A 3-day FDP on AI in Education starts December 1. Confirm your participation.', 'info', '/teacher/notices');
    });

    // ===== ACTIVITY LOG =====
    const logStmt = db.prepare(`INSERT INTO activity_log(user_id, action, entity_type, details) VALUES (?,?,?,?)`);
    logStmt.run(adminId, 'system_seed', 'system', 'Database initialized with demo data');

    console.log(`✓ Seed complete.`);
    console.log(`  - ${depts.length} departments, ${courses.length} courses, ${subjects.length} subjects`);
    console.log(`  - ${teacherUsers.length} teachers, ${studentCounter} students`);
    console.log(`  - ${notices.length} notices, ${materials.length} study materials`);
    console.log(`  - Timetable, attendance, exams, results, fees all seeded`);
    console.log('');
    console.log('── Demo Credentials ──────────────────────');
    console.log('  Admin    → username: admin       password: admin123');
    console.log('  Teacher  → username: prof.sharma password: teacher123');
    console.log('  Student  → username: aarav.sharma1  password: student123');
    console.log('──────────────────────────────────────────');
  });

  seedAll();
}

module.exports = { seed };
