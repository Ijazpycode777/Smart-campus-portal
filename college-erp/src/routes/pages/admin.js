// Admin portal page routes
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { Dashboard } = require('../../utils/queries');
const { formatCurrency, formatDate, timeAgo, marksToGrade, currentAcademicYear } = require('../../utils/helpers');

// ============ Dashboard ============
router.get('/', (req, res) => {
  const db = getDb();
  const stats = Dashboard.adminStats();
  const deptDist = Dashboard.adminDeptDistribution();
  const feeColl = Dashboard.adminFeeCollection();
  const studentGrowth = Dashboard.adminStudentGrowth();
  const recentActivity = Dashboard.adminRecentActivity(8);
  const recentNotices = db.prepare(`SELECT n.*, u.full_name as posted_by_name FROM notices n LEFT JOIN users u ON u.id=n.posted_by ORDER BY n.created_at DESC LIMIT 5`).all();
  const recentStudents = db.prepare(`SELECT s.*, u.full_name, u.email, u.avatar_color, c.name as course_name, d.code as dept_code FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN courses c ON c.id=s.course_id LEFT JOIN departments d ON d.id=s.department_id ORDER BY s.id DESC LIMIT 5`).all();

  res.render('admin/dashboard', {
    layout: 'layout',
    pageTitle: 'Admin Dashboard',
    pageSubtitle: `Academic Year ${currentAcademicYear()}`,
    nav: 'dashboard',
    body: null, // will be set below by render
    stats, deptDist, feeColl, studentGrowth, recentActivity, recentNotices, recentStudents,
    _renderBody: 'admin/dashboard',
  });
});

// ============ Analytics ============
router.get('/analytics', (req, res) => {
  const db = getDb();
  const deptDist = Dashboard.adminDeptDistribution();
  const feeColl = Dashboard.adminFeeCollection();
  const studentGrowth = Dashboard.adminStudentGrowth();
  // attendance overview
  const attendanceStats = db.prepare(`
    SELECT
      SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) as late,
      COUNT(*) as total
    FROM attendance
  `).get();
  // grade distribution
  const gradeDist = db.prepare(`SELECT grade, COUNT(*) as count FROM results GROUP BY grade ORDER BY grade`).all();
  // gender
  const genderDist = db.prepare(`SELECT gender, COUNT(*) as count FROM students WHERE gender IS NOT NULL GROUP BY gender`).all();
  // top students
  const topStudents = db.prepare(`
    SELECT s.id, u.full_name, u.avatar_color, s.roll_number,
      AVG(r.marks_obtained * 100.0 / e.total_marks) as avg_pct
    FROM students s JOIN users u ON u.id=s.user_id
    JOIN results r ON r.student_id=s.id
    JOIN examinations e ON e.id=r.examination_id
    GROUP BY s.id ORDER BY avg_pct DESC LIMIT 5
  `).all();
  // enrollment per course
  const courseEnroll = db.prepare(`
    SELECT c.code, c.name, COUNT(s.id) as students
    FROM courses c LEFT JOIN students s ON s.course_id=c.id
    GROUP BY c.id ORDER BY students DESC
  `).all();

  res.render('admin/analytics', {
    layout: 'layout', pageTitle: 'Analytics', pageSubtitle: 'Institutional insights & reports', nav: 'analytics',
    deptDist, feeColl, studentGrowth, attendanceStats, gradeDist, genderDist, topStudents, courseEnroll,
  });
});

// ============ Students ============
router.get('/students', (req, res) => {
  const db = getDb();
  const q = (req.query.q || '').trim();
  const courseId = req.query.course_id || '';
  const deptId = req.query.department_id || '';
  let sql = `SELECT s.*, u.full_name, u.email, u.phone, u.avatar_color, u.is_active, c.name as course_name, d.code as dept_code, d.name as dept_name
             FROM students s JOIN users u ON u.id=s.user_id
             LEFT JOIN courses c ON c.id=s.course_id
             LEFT JOIN departments d ON d.id=s.department_id WHERE 1=1`;
  const params = [];
  if (q) { sql += ` AND (u.full_name LIKE ? OR s.roll_number LIKE ? OR u.email LIKE ?)`; params.push('%'+q+'%','%'+q+'%','%'+q+'%'); }
  if (courseId) { sql += ` AND s.course_id=?`; params.push(courseId); }
  if (deptId) { sql += ` AND s.department_id=?`; params.push(deptId); }
  sql += ` ORDER BY s.roll_number ASC`;
  const students = db.prepare(sql).all(...params);
  const courses = db.prepare('SELECT * FROM courses ORDER BY name').all();
  const departments = db.prepare('SELECT * FROM departments ORDER BY name').all();
  res.render('admin/students', {
    layout: 'layout', pageTitle: 'Students', pageSubtitle: `${students.length} students enrolled`, nav: 'students',
    students, courses, departments, q, courseId, deptId,
  });
});

// student detail
router.get('/students/:id', (req, res) => {
  const db = getDb();
  const student = db.prepare(`
    SELECT s.*, u.full_name, u.email, u.phone, u.avatar_color, u.username, u.is_active, u.created_at,
      c.name as course_name, c.code as course_code, d.name as dept_name, d.code as dept_code
    FROM students s JOIN users u ON u.id=s.user_id
    LEFT JOIN courses c ON c.id=s.course_id
    LEFT JOIN departments d ON d.id=s.department_id
    WHERE s.id=?
  `).get(req.params.id);
  if (!student) return res.status(404).render('errors/404', { layout: false });
  const attendance = db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) present, SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) absent, SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) late FROM attendance WHERE student_id=?`).get(req.params.id);
  const results = db.prepare(`SELECT r.*, e.name as exam_name, e.total_marks, e.passing_marks, e.exam_date, sub.name as subject_name, sub.code as subject_code FROM results r JOIN examinations e ON e.id=r.examination_id JOIN subjects sub ON sub.id=e.subject_id WHERE r.student_id=? ORDER BY e.exam_date DESC`).all(req.params.id);
  const invoices = db.prepare(`SELECT * FROM fee_invoices WHERE student_id=? ORDER BY created_at DESC`).all(req.params.id);
  const classes = db.prepare(`SELECT c.* FROM class_students cs JOIN classes c ON c.id=cs.class_id WHERE cs.student_id=?`).all(req.params.id);
  res.render('admin/student-detail', {
    layout: 'layout', pageTitle: student.full_name, pageSubtitle: student.roll_number, nav: 'students',
    student, attendance, results, invoices, classes,
  });
});

// ============ Teachers ============
router.get('/teachers', (req, res) => {
  const db = getDb();
  const q = (req.query.q || '').trim();
  let sql = `SELECT t.*, u.full_name, u.email, u.phone, u.avatar_color, u.is_active, d.code as dept_code, d.name as dept_name,
    (SELECT COUNT(*) FROM class_subjects cs WHERE cs.teacher_id=t.id) as class_count
    FROM teachers t JOIN users u ON u.id=t.user_id
    LEFT JOIN departments d ON d.id=t.department_id WHERE 1=1`;
  const params = [];
  if (q) { sql += ` AND (u.full_name LIKE ? OR t.employee_id LIKE ? OR u.email LIKE ?)`; params.push('%'+q+'%','%'+q+'%','%'+q+'%'); }
  sql += ` ORDER BY t.employee_id`;
  const teachers = db.prepare(sql).all(...params);
  const departments = db.prepare('SELECT * FROM departments ORDER BY name').all();
  res.render('admin/teachers', {
    layout: 'layout', pageTitle: 'Teachers', pageSubtitle: `${teachers.length} faculty members`, nav: 'teachers',
    teachers, departments, q,
  });
});

// ============ Classes ============
router.get('/classes', (req, res) => {
  const db = getDb();
  const classes = db.prepare(`
    SELECT c.*, co.name as course_name, co.code as course_code, u.full_name as class_teacher_name,
      (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id=c.id) as student_count,
      (SELECT COUNT(*) FROM class_subjects cs WHERE cs.class_id=c.id) as subject_count
    FROM classes c
    LEFT JOIN courses co ON co.id=c.course_id
    LEFT JOIN teachers t ON t.id=c.class_teacher_id
    LEFT JOIN users u ON u.id=t.user_id
    ORDER BY c.name
  `).all();
  const courses = db.prepare('SELECT * FROM courses ORDER BY name').all();
  const teachers = db.prepare(`SELECT t.id, u.full_name FROM teachers t JOIN users u ON u.id=t.user_id ORDER BY u.full_name`).all();
  res.render('admin/classes', {
    layout: 'layout', pageTitle: 'Classes', pageSubtitle: `${classes.length} active classes`, nav: 'classes',
    classes, courses, teachers,
  });
});

// class detail
router.get('/classes/:id', (req, res) => {
  const db = getDb();
  const cls = db.prepare(`
    SELECT c.*, co.name as course_name, co.code as course_code, u.full_name as class_teacher_name
    FROM classes c LEFT JOIN courses co ON co.id=c.course_id
    LEFT JOIN teachers t ON t.id=c.class_teacher_id LEFT JOIN users u ON u.id=t.user_id
    WHERE c.id=?`).get(req.params.id);
  if (!cls) return res.status(404).render('errors/404', { layout: false });
  const students = db.prepare(`SELECT s.*, u.full_name, u.email, u.avatar_color FROM class_students cs JOIN students s ON s.id=cs.student_id JOIN users u ON u.id=s.user_id WHERE cs.class_id=? ORDER BY s.roll_number`).all(req.params.id);
  const subjects = db.prepare(`SELECT cs.*, s.code as subject_code, s.name as subject_name, u.full_name as teacher_name FROM class_subjects cs JOIN subjects s ON s.id=cs.subject_id LEFT JOIN teachers t ON t.id=cs.teacher_id LEFT JOIN users u ON u.id=t.user_id WHERE cs.class_id=?`).all(req.params.id);
  res.render('admin/class-detail', {
    layout: 'layout', pageTitle: cls.name, pageSubtitle: `${students.length} students`, nav: 'classes',
    cls, students, subjects,
  });
});

// ============ Courses ============
router.get('/courses', (req, res) => {
  const db = getDb();
  const courses = db.prepare(`
    SELECT c.*, d.code as dept_code, d.name as dept_name,
      (SELECT COUNT(*) FROM students s WHERE s.course_id=c.id) as student_count,
      (SELECT COUNT(*) FROM subjects sub WHERE sub.department_id=c.department_id) as subject_count
    FROM courses c LEFT JOIN departments d ON d.id=c.department_id ORDER BY c.name
  `).all();
  const departments = db.prepare('SELECT * FROM departments').all();
  res.render('admin/courses', {
    layout: 'layout', pageTitle: 'Courses', pageSubtitle: `${courses.length} academic programs`, nav: 'courses',
    courses, departments,
  });
});

// ============ Subjects ============
router.get('/subjects', (req, res) => {
  const db = getDb();
  const subjects = db.prepare(`
    SELECT s.*, d.code as dept_code, d.name as dept_name,
      (SELECT COUNT(*) FROM class_subjects cs WHERE cs.subject_id=s.id) as class_count
    FROM subjects s LEFT JOIN departments d ON d.id=s.department_id ORDER BY s.code
  `).all();
  const departments = db.prepare('SELECT * FROM departments').all();
  res.render('admin/subjects', {
    layout: 'layout', pageTitle: 'Subjects', pageSubtitle: `${subjects.length} subjects`, nav: 'subjects',
    subjects, departments,
  });
});

// ============ Departments ============
router.get('/departments', (req, res) => {
  const db = getDb();
  const departments = db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM students s WHERE s.department_id=d.id) as student_count,
      (SELECT COUNT(*) FROM teachers t WHERE t.department_id=d.id) as teacher_count,
      (SELECT COUNT(*) FROM courses c WHERE c.department_id=d.id) as course_count
    FROM departments d ORDER BY d.name
  `).all();
  res.render('admin/departments', {
    layout: 'layout', pageTitle: 'Departments', pageSubtitle: `${departments.length} departments`, nav: 'departments',
    departments,
  });
});

// ============ Timetable ============
router.get('/timetable', (req, res) => {
  const db = getDb();
  const classId = req.query.class_id;
  const classes = db.prepare('SELECT * FROM classes ORDER BY name').all();
  let timetable = [];
  if (classId) {
    timetable = db.prepare(`SELECT t.*, s.name as subject_name, s.code as subject_code, u.full_name as teacher_name FROM timetable t JOIN subjects s ON s.id=t.subject_id LEFT JOIN teachers tt ON tt.id=t.teacher_id LEFT JOIN users u ON u.id=tt.user_id WHERE t.class_id=? ORDER BY CASE day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 7 END, start_time`).all(classId);
  }
  const subjects = db.prepare('SELECT * FROM subjects ORDER BY name').all();
  const teachers = db.prepare('SELECT t.id, u.full_name FROM teachers t JOIN users u ON u.id=t.user_id').all();
  res.render('admin/timetable', {
    layout: 'layout', pageTitle: 'Timetable', pageSubtitle: 'Manage weekly schedules', nav: 'timetable',
    classes, classId, timetable, subjects, teachers,
  });
});

// ============ Examinations ============
router.get('/examinations', (req, res) => {
  const db = getDb();
  const exams = db.prepare(`
    SELECT e.*, c.name as class_name, s.code as subject_code, s.name as subject_name,
      u.full_name as created_by_name,
      (SELECT COUNT(*) FROM results r WHERE r.examination_id=e.id) as results_count
    FROM examinations e JOIN classes c ON c.id=e.class_id
    JOIN subjects s ON s.id=e.subject_id
    LEFT JOIN users u ON u.id=e.created_by ORDER BY e.exam_date DESC, e.id DESC
  `).all();
  const classes = db.prepare('SELECT * FROM classes ORDER BY name').all();
  res.render('admin/examinations', {
    layout: 'layout', pageTitle: 'Examinations', pageSubtitle: `${exams.length} examinations scheduled`, nav: 'examinations',
    exams, classes,
  });
});

// ============ Results ============
router.get('/results', (req, res) => {
  const db = getDb();
  const examId = req.query.exam_id;
  const exams = db.prepare(`SELECT e.*, c.name as class_name, s.code as subject_code FROM examinations e JOIN classes c ON c.id=e.class_id JOIN subjects s ON s.id=e.subject_id ORDER BY e.id DESC`).all();
  let results = [];
  if (examId) {
    results = db.prepare(`
      SELECT r.*, u.full_name, u.avatar_color, s.roll_number
      FROM results r JOIN students s ON s.id=r.student_id JOIN users u ON u.id=s.user_id
      WHERE r.examination_id=? ORDER BY r.marks_obtained DESC
    `).all(examId);
  } else if (exams.length) {
    results = db.prepare(`
      SELECT r.*, u.full_name, u.avatar_color, s.roll_number
      FROM results r JOIN students s ON s.id=r.student_id JOIN users u ON u.id=s.user_id
      WHERE r.examination_id=? ORDER BY r.marks_obtained DESC
    `).all(exams[0].id);
  }
  res.render('admin/results', {
    layout: 'layout', pageTitle: 'Results', pageSubtitle: 'View & analyze examination results', nav: 'results',
    exams, results, selectedExamId: examId || (exams[0] && exams[0].id),
  });
});

// ============ Fees ============
router.get('/fees', (req, res) => {
  const db = getDb();
  const status = req.query.status || '';
  let sql = `SELECT fi.*, s.roll_number, u.full_name, u.avatar_color, c.code as course_code
             FROM fee_invoices fi JOIN students s ON s.id=fi.student_id
             JOIN users u ON u.id=s.user_id
             LEFT JOIN courses c ON c.id=s.course_id WHERE 1=1`;
  const params = [];
  if (status) { sql += ` AND fi.status=?`; params.push(status); }
  sql += ` ORDER BY fi.created_at DESC LIMIT 100`;
  const invoices = db.prepare(sql).all(...params);
  const totals = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(total_amount-paid_amount),0) as due FROM fee_invoices`).get();
  const students = db.prepare(`SELECT s.id, s.roll_number, u.full_name FROM students s JOIN users u ON u.id=s.user_id ORDER BY s.roll_number`).all();
  res.render('admin/fees', {
    layout: 'layout', pageTitle: 'Fee Management', pageSubtitle: 'Invoices, payments & dues', nav: 'fees',
    invoices, totals, status, students,
  });
});

// ============ Payments ============
router.get('/payments', (req, res) => {
  const db = getDb();
  const payments = db.prepare(`
    SELECT p.*, fi.invoice_number, s.roll_number, u.full_name, u.avatar_color
    FROM payments p JOIN fee_invoices fi ON fi.id=p.invoice_id
    JOIN students s ON s.id=p.student_id JOIN users u ON u.id=s.user_id
    ORDER BY p.payment_date DESC LIMIT 100
  `).all();
  const totalCollected = db.prepare('SELECT COALESCE(SUM(amount),0) s FROM payments').get().s;
  const todayCollected = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE date(payment_date)=date('now')").get().s;
  const monthCollected = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE strftime('%Y-%m', payment_date)=strftime('%Y-%m','now')").get().s;
  res.render('admin/payments', {
    layout: 'layout', pageTitle: 'Payments', pageSubtitle: 'Transaction history', nav: 'payments',
    payments, totalCollected, todayCollected, monthCollected,
  });
});

// ============ Notices ============
router.get('/notices', (req, res) => {
  const db = getDb();
  const notices = db.prepare(`SELECT n.*, u.full_name as posted_by_name FROM notices n LEFT JOIN users u ON u.id=n.posted_by ORDER BY n.is_pinned DESC, n.created_at DESC`).all();
  res.render('admin/notices', {
    layout: 'layout', pageTitle: 'Notices', pageSubtitle: `${notices.length} announcements`, nav: 'notices',
    notices,
  });
});

// ============ Leaves ============
router.get('/leaves', (req, res) => {
  const db = getDb();
  const status = req.query.status || '';
  let sql = `SELECT lr.*, u.full_name, u.avatar_color, u.role, ru.full_name as reviewer_name
             FROM leave_requests lr JOIN users u ON u.id=lr.user_id
             LEFT JOIN users ru ON ru.id=lr.reviewed_by WHERE 1=1`;
  const params = [];
  if (status) { sql += ` AND lr.status=?`; params.push(status); }
  sql += ` ORDER BY lr.created_at DESC`;
  const leaves = db.prepare(sql).all(...params);
  res.render('admin/leaves', {
    layout: 'layout', pageTitle: 'Leave Requests', pageSubtitle: 'Faculty & student leave applications', nav: 'leaves',
    leaves, status,
  });
});

// ============ Activity Log ============
router.get('/activity', (req, res) => {
  const db = getDb();
  const logs = db.prepare(`SELECT al.*, u.full_name, u.role, u.avatar_color FROM activity_log al LEFT JOIN users u ON u.id=al.user_id ORDER BY al.created_at DESC LIMIT 200`).all();
  res.render('admin/activity', {
    layout: 'layout', pageTitle: 'Activity Log', pageSubtitle: `${logs.length} recent activities`, nav: 'activity',
    logs,
  });
});

// ============ Settings ============
router.get('/settings', (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM settings').all();
  const obj = {}; settings.forEach(s => obj[s.key] = s.value);
  res.render('admin/settings', {
    layout: 'layout', pageTitle: 'Settings', pageSubtitle: 'System configuration', nav: 'settings',
    settings: obj,
  });
});

module.exports = router;
