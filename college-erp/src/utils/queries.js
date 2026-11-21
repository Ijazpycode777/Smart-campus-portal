// Shared data-access layer for dashboard queries.
const { getDb } = require('../db/connection');
const { marksToGrade } = require('./helpers');

const Dashboard = {
  adminStats() {
    const db = getDb();
    const students = db.prepare("SELECT COUNT(*) c FROM students WHERE status='active'").get().c;
    const teachers = db.prepare('SELECT COUNT(*) c FROM teachers').get().c;
    const classes  = db.prepare('SELECT COUNT(*) c FROM classes').get().c;
    const courses  = db.prepare('SELECT COUNT(*) c FROM courses').get().c;
    const departments = db.prepare('SELECT COUNT(*) c FROM departments').get().c;
    const subjects = db.prepare('SELECT COUNT(*) c FROM subjects').get().c;
    const pendingFees = db.prepare("SELECT COALESCE(SUM(total_amount - paid_amount),0) s FROM fee_invoices WHERE status!='paid'").get().s;
    const collectedFees = db.prepare("SELECT COALESCE(SUM(paid_amount),0) s FROM fee_invoices").get().s;
    const notices = db.prepare('SELECT COUNT(*) c FROM notices').get().c;
    return { students, teachers, classes, courses, departments, subjects, pendingFees, collectedFees, notices };
  },

  adminStudentGrowth() {
    const db = getDb();
    // students per batch year
    return db.prepare("SELECT batch_year, COUNT(*) as count FROM students GROUP BY batch_year ORDER BY batch_year").all();
  },

  adminDeptDistribution() {
    const db = getDb();
    return db.prepare(`
      SELECT d.code, d.name, COUNT(s.id) as students
      FROM departments d
      LEFT JOIN students s ON s.department_id = d.id
      GROUP BY d.id ORDER BY students DESC
    `).all();
  },

  adminFeeCollection() {
    const db = getDb();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const m = d.toISOString().slice(0,7); // YYYY-MM
      const r = db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM payments WHERE strftime('%Y-%m', payment_date) = ?`).get(m);
      months.push({ month: d.toLocaleString('en-IN', { month: 'short' }), total: r.s });
    }
    return months;
  },

  adminRecentActivity(limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT al.*, u.full_name, u.role
      FROM activity_log al LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC LIMIT ?
    `).all(limit);
  },

  teacherStats(userId) {
    const db = getDb();
    const teacher = db.prepare('SELECT * FROM teachers WHERE user_id=?').get(userId);
    if (!teacher) return null;
    const classes = db.prepare("SELECT COUNT(*) c FROM class_subjects WHERE teacher_id=?").get(teacher.id).c;
    const subjects = db.prepare("SELECT COUNT(DISTINCT subject_id) c FROM class_subjects WHERE teacher_id=?").get(teacher.id).c;
    const students = db.prepare(`
      SELECT COUNT(DISTINCT cs.student_id) c FROM class_subjects cls
      JOIN class_students cs ON cs.class_id = cls.class_id
      WHERE cls.teacher_id=?
    `).get(teacher.id).c;
    const exams = db.prepare("SELECT COUNT(*) c FROM examinations WHERE created_by=?").get(userId).c;
    const materials = db.prepare("SELECT COUNT(*) c FROM study_materials WHERE uploaded_by=?").get(userId).c;
    return { teacher, classes, subjects, students, exams, materials };
  },

  teacherClasses(userId) {
    const db = getDb();
    const teacher = db.prepare('SELECT id FROM teachers WHERE user_id=?').get(userId);
    if (!teacher) return [];
    return db.prepare(`
      SELECT DISTINCT c.*, co.name as course_name, t.full_name as class_teacher_name,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) as student_count
      FROM classes c
      JOIN class_subjects cls ON cls.class_id = c.id
      JOIN courses co ON co.id = c.course_id
      LEFT JOIN teachers tt ON tt.id = c.class_teacher_id
      LEFT JOIN users t ON t.id = tt.user_id
      WHERE cls.teacher_id = ?
      ORDER BY c.name
    `).all(teacher.id);
  },

  teacherTodayTimetable(userId) {
    const db = getDb();
    const teacher = db.prepare('SELECT id FROM teachers WHERE user_id=?').get(userId);
    if (!teacher) return [];
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long' });
    return db.prepare(`
      SELECT t.*, s.name as subject_name, s.code as subject_code, c.name as class_name
      FROM timetable t
      JOIN subjects s ON s.id = t.subject_id
      JOIN classes c ON c.id = t.class_id
      WHERE t.teacher_id=? AND t.day_of_week=?
      ORDER BY t.start_time
    `).all(teacher.id, today);
  },

  studentStats(userId) {
    const db = getDb();
    const st = db.prepare(`
      SELECT s.*, c.name as course_name, d.name as dept_name, d.code as dept_code
      FROM students s
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN departments d ON d.id = s.department_id
      WHERE s.user_id=?
    `).get(userId);
    if (!st) return null;
    const totalDue = db.prepare("SELECT COALESCE(SUM(total_amount - paid_amount),0) s FROM fee_invoices WHERE student_id=? AND status!='paid'").get(st.id).s;
    const totalPaid = db.prepare("SELECT COALESCE(SUM(paid_amount),0) s FROM fee_invoices WHERE student_id=?").get(st.id).s;
    // attendance
    const attRow = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) as late
      FROM attendance WHERE student_id=?
    `).get(st.id);
    const attendancePct = attRow.total > 0 ? Math.round((attRow.present / attRow.total) * 100) : 0;
    // results
    const results = db.prepare(`
      SELECT r.*, e.name as exam_name, e.total_marks, e.passing_marks, sub.name as subject_name, sub.code as subject_code
      FROM results r
      JOIN examinations e ON e.id = r.examination_id
      JOIN subjects sub ON sub.id = e.subject_id
      WHERE r.student_id=?
      ORDER BY e.exam_date DESC
    `).all(st.id);
    const avgMarks = results.length ? (results.reduce((a,r) => a + (r.marks_obtained / r.total_marks) * 100, 0) / results.length) : 0;
    return { student: st, totalDue, totalPaid, attendancePct, attTotal: attRow.total, attPresent: attRow.present, attAbsent: attRow.absent, attLate: attRow.late, resultsCount: results.length, avgMarks: Math.round(avgMarks) };
  },

  studentTimetable(userId) {
    const db = getDb();
    const st = db.prepare('SELECT id FROM students WHERE user_id=?').get(userId);
    if (!st) return [];
    const enrolled = db.prepare('SELECT class_id FROM class_students WHERE student_id=?').all(st.id).map(e => e.class_id);
    if (!enrolled.length) return [];
    const placeholders = enrolled.map(() => '?').join(',');
    return db.prepare(`
      SELECT t.*, s.name as subject_name, s.code as subject_code,
        c.name as class_name, u.full_name as teacher_name
      FROM timetable t
      JOIN subjects s ON s.id = t.subject_id
      JOIN classes c ON c.id = t.class_id
      LEFT JOIN teachers tt ON tt.id = t.teacher_id
      LEFT JOIN users u ON u.id = tt.user_id
      WHERE t.class_id IN (${placeholders})
      ORDER BY CASE t.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 7 END, t.start_time
    `).all(...enrolled);
  },

  studentMaterials(userId) {
    const db = getDb();
    const st = db.prepare('SELECT id FROM students WHERE user_id=?').get(userId);
    if (!st) return [];
    const enrolled = db.prepare('SELECT class_id FROM class_students WHERE student_id=?').all(st.id).map(e => e.class_id);
    if (!enrolled.length) return [];
    const placeholders = enrolled.map(() => '?').join(',');
    return db.prepare(`
      SELECT m.*, s.name as subject_name, s.code as subject_code, u.full_name as uploaded_by_name
      FROM study_materials m
      LEFT JOIN subjects s ON s.id = m.subject_id
      LEFT JOIN users u ON u.id = m.uploaded_by
      WHERE m.class_id IN (${placeholders})
      ORDER BY m.created_at DESC
    `).all(...enrolled);
  },

  studentAssignments(userId) {
    const db = getDb();
    const st = db.prepare('SELECT id FROM students WHERE user_id=?').get(userId);
    if (!st) return [];
    const enrolled = db.prepare('SELECT class_id FROM class_students WHERE student_id=?').all(st.id).map(e => e.class_id);
    if (!enrolled.length) return [];
    const placeholders = enrolled.map(() => '?').join(',');
    return db.prepare(`
      SELECT a.*, s.name as subject_name, s.code as subject_code,
        sub.id as submission_id, sub.submitted_at, sub.marks_obtained, sub.feedback
      FROM assignments a
      JOIN subjects s ON s.id = a.subject_id
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
      WHERE a.class_id IN (${placeholders})
      ORDER BY a.due_date DESC
    `).all(st.id, ...enrolled);
  },

  allNoticesFor(role) {
    const db = getDb();
    return db.prepare(`
      SELECT n.*, u.full_name as posted_by_name
      FROM notices n LEFT JOIN users u ON u.id = n.posted_by
      WHERE n.target_audience IN ('all', ?)
      ORDER BY n.is_pinned DESC, n.created_at DESC
    `).all(role);
  },

  notificationsFor(userId) {
    const db = getDb();
    return db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(userId);
  },
};

module.exports = { Dashboard };
