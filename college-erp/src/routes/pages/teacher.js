// Teacher portal page routes
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { Dashboard } = require('../../utils/queries');
const { formatCurrency, formatDate, timeAgo, marksToGrade, currentAcademicYear } = require('../../utils/helpers');

function getTeacher(req) {
  const db = getDb();
  return db.prepare('SELECT * FROM teachers WHERE user_id=?').get(req.session.userId);
}

// ============ Dashboard ============
router.get('/', (req, res) => {
  const db = getDb();
  const stats = Dashboard.teacherStats(req.session.userId);
  if (!stats) return res.redirect('/logout');
  const classes = Dashboard.teacherClasses(req.session.userId);
  const today = Dashboard.teacherTodayTimetable(req.session.userId);
  const notices = Dashboard.allNoticesFor('teacher').slice(0, 5);
  // recent attendance marked by this teacher
  const recentAttendance = db.prepare(`
    SELECT a.date, a.status, COUNT(*) as count, s.name as subject_name, s.code as subject_code, c.name as class_name
    FROM attendance a
    JOIN subjects s ON s.id=a.subject_id
    JOIN classes c ON c.id=a.class_id
    WHERE a.marked_by=?
    GROUP BY a.date, a.subject_id, a.class_id
    ORDER BY a.date DESC LIMIT 5
  `).all(req.session.userId);
  // pending grading
  const pendingSubmissions = db.prepare(`
    SELECT sub.*, a.title as assignment_title, a.due_date, u.full_name, u.avatar_color, s.roll_number
    FROM assignment_submissions sub
    JOIN assignments a ON a.id=sub.assignment_id
    JOIN students s ON s.id=sub.student_id
    JOIN users u ON u.id=s.user_id
    WHERE sub.graded_at IS NULL AND a.teacher_id=?
    ORDER BY sub.submitted_at DESC LIMIT 5
  `).all(stats.teacher.id);

  res.render('teacher/dashboard', {
    layout: false, pageTitle: 'Teacher Dashboard', pageSubtitle: `Welcome, ${req.session.fullName.split(' ')[0]}`,
    nav: 'dashboard', stats, classes, today, notices, recentAttendance, pendingSubmissions,
  });
});

// ============ Classes ============
router.get('/classes', (req, res) => {
  const db = getDb();
  const teacher = getTeacher(req);
  const classes = db.prepare(`
    SELECT DISTINCT c.*, co.name as course_name, co.code as course_code, u.full_name as class_teacher_name,
      (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id=c.id) as student_count
    FROM classes c
    JOIN class_subjects cls ON cls.class_id=c.id
    JOIN courses co ON co.id=c.course_id
    LEFT JOIN teachers tt ON tt.id=c.class_teacher_id
    LEFT JOIN users u ON u.id=tt.user_id
    WHERE cls.teacher_id=?
    ORDER BY c.name
  `).all(teacher.id);
  res.render('teacher/classes', {
    layout: false, pageTitle: 'My Classes', pageSubtitle: `${classes.length} classes assigned`, nav: 'classes',
    classes,
  });
});

// class detail with students
router.get('/classes/:id', (req, res) => {
  const db = getDb();
  const teacher = getTeacher(req);
  const cls = db.prepare(`
    SELECT c.*, co.name as course_name, co.code as course_code, u.full_name as class_teacher_name
    FROM classes c LEFT JOIN courses co ON co.id=c.course_id
    LEFT JOIN teachers t ON t.id=c.class_teacher_id LEFT JOIN users u ON u.id=t.user_id
    WHERE c.id=?`).get(req.params.id);
  if (!cls) return res.status(404).render('errors/404', { layout: false });
  const students = db.prepare(`
    SELECT s.*, u.full_name, u.email, u.avatar_color,
      (SELECT COUNT(*) FROM attendance a WHERE a.student_id=s.id AND a.class_id=c.id) as total_att,
      (SELECT COUNT(*) FROM attendance a WHERE a.student_id=s.id AND a.class_id=c.id AND a.status='present') as present_att
    FROM class_students cs JOIN students s ON s.id=cs.student_id
    JOIN users u ON u.id=s.user_id
    JOIN classes c ON c.id=cs.class_id
    WHERE cs.class_id=?
    ORDER BY s.roll_number
  `).all(req.params.id);
  const subjects = db.prepare(`
    SELECT cs.*, s.code as subject_code, s.name as subject_name
    FROM class_subjects cs JOIN subjects s ON s.id=cs.subject_id
    WHERE cs.class_id=? AND cs.teacher_id=?`).all(req.params.id, teacher.id);
  res.render('teacher/class-detail', {
    layout: false, pageTitle: cls.name, pageSubtitle: `${students.length} students`, nav: 'classes',
    cls, students, subjects,
  });
});

// ============ Timetable ============
router.get('/timetable', (req, res) => {
  const db = getDb();
  const teacher = getTeacher(req);
  const timetable = db.prepare(`
    SELECT t.*, s.name as subject_name, s.code as subject_code, c.name as class_name, c.id as class_id
    FROM timetable t
    JOIN subjects s ON s.id=t.subject_id
    JOIN classes c ON c.id=t.class_id
    WHERE t.teacher_id=?
    ORDER BY CASE t.day_of_week WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE 7 END, t.start_time
  `).all(teacher.id);
  res.render('teacher/timetable', {
    layout: false, pageTitle: 'My Timetable', pageSubtitle: 'Weekly teaching schedule', nav: 'timetable',
    timetable,
  });
});

// ============ Attendance ============
router.get('/attendance', (req, res) => {
  const db = getDb();
  const teacher = getTeacher(req);
  const classId = req.query.class_id;
  const subjectId = req.query.subject_id;
  const date = req.query.date || new Date().toISOString().slice(0,10);
  // teacher's class+subject combinations
  const myClasses = db.prepare(`
    SELECT DISTINCT c.id, c.name, s.id as subject_id, s.code as subject_code, s.name as subject_name
    FROM class_subjects cls
    JOIN classes c ON c.id=cls.class_id
    JOIN subjects s ON s.id=cls.subject_id
    WHERE cls.teacher_id=?
    ORDER BY c.name
  `).all(teacher.id);
  let students = [];
  if (classId && subjectId) {
    students = db.prepare(`
      SELECT s.id, s.roll_number, u.full_name, u.avatar_color,
        (SELECT status FROM attendance a WHERE a.student_id=s.id AND a.class_id=? AND a.subject_id=? AND a.date=?) as status
      FROM class_students cs
      JOIN students s ON s.id=cs.student_id
      JOIN users u ON u.id=s.user_id
      WHERE cs.class_id=?
      ORDER BY s.roll_number
    `).all(classId, subjectId, date, classId);
  }
  // recent attendance sessions by this teacher
  const recentSessions = db.prepare(`
    SELECT a.date, a.class_id, a.subject_id, c.name as class_name, s.code as subject_code, s.name as subject_name,
      COUNT(*) as total,
      SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) as absent
    FROM attendance a
    JOIN classes c ON c.id=a.class_id
    JOIN subjects s ON s.id=a.subject_id
    WHERE a.marked_by=?
    GROUP BY a.date, a.class_id, a.subject_id
    ORDER BY a.date DESC LIMIT 8
  `).all(req.session.userId);
  res.render('teacher/attendance', {
    layout: false, pageTitle: 'Mark Attendance', pageSubtitle: 'Record student attendance', nav: 'attendance',
    myClasses, classId, subjectId, date, students, recentSessions,
  });
});

// ============ Examinations ============
router.get('/examinations', (req, res) => {
  const db = getDb();
  const teacher = getTeacher(req);
  const exams = db.prepare(`
    SELECT e.*, c.name as class_name, s.code as subject_code, s.name as subject_name,
      (SELECT COUNT(*) FROM results r WHERE r.examination_id=e.id) as results_count
    FROM examinations e
    JOIN classes c ON c.id=e.class_id
    JOIN subjects s ON s.id=e.subject_id
    WHERE e.created_by=?
    ORDER BY e.id DESC
  `).all(req.session.userId);
  const myClasses = db.prepare(`
    SELECT DISTINCT c.id, c.name, s.id as subject_id, s.code as subject_code, s.name as subject_name
    FROM class_subjects cls JOIN classes c ON c.id=cls.class_id JOIN subjects s ON s.id=cls.subject_id
    WHERE cls.teacher_id=?`).all(teacher.id);
  res.render('teacher/examinations', {
    layout: false, pageTitle: 'Examinations', pageSubtitle: `${exams.length} exams created`, nav: 'examinations',
    exams, myClasses,
  });
});

// exam detail with results entry
router.get('/examinations/:id', (req, res) => {
  const db = getDb();
  const exam = db.prepare(`
    SELECT e.*, c.name as class_name, s.code as subject_code, s.name as subject_name
    FROM examinations e JOIN classes c ON c.id=e.class_id JOIN subjects s ON s.id=e.subject_id
    WHERE e.id=?`).get(req.params.id);
  if (!exam) return res.status(404).render('errors/404', { layout: false });
  const students = db.prepare(`
    SELECT s.id, s.roll_number, u.full_name, u.avatar_color,
      (SELECT r.marks_obtained FROM results r WHERE r.examination_id=? AND r.student_id=s.id) as marks_obtained,
      (SELECT r.grade FROM results r WHERE r.examination_id=? AND r.student_id=s.id) as grade,
      (SELECT r.remarks FROM results r WHERE r.examination_id=? AND r.student_id=s.id) as remarks
    FROM class_students cs JOIN students s ON s.id=cs.student_id JOIN users u ON u.id=s.user_id
    WHERE cs.class_id=?
    ORDER BY s.roll_number
  `).all(exam.id, exam.id, exam.id, exam.class_id);
  res.render('teacher/exam-detail', {
    layout: false, pageTitle: exam.name, pageSubtitle: `${students.length} students`, nav: 'examinations',
    exam, students,
  });
});

// ============ Assignments ============
router.get('/assignments', (req, res) => {
  const db = getDb();
  const teacher = getTeacher(req);
  const assignments = db.prepare(`
    SELECT a.*, c.name as class_name, s.code as subject_code, s.name as subject_name,
      (SELECT COUNT(*) FROM assignment_submissions sub WHERE sub.assignment_id=a.id) as submissions_count,
      (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id=a.class_id) as total_students
    FROM assignments a
    JOIN classes c ON c.id=a.class_id
    JOIN subjects s ON s.id=a.subject_id
    WHERE a.teacher_id=?
    ORDER BY a.id DESC
  `).all(teacher.id);
  const myClasses = db.prepare(`
    SELECT DISTINCT c.id, c.name, s.id as subject_id, s.code as subject_code, s.name as subject_name
    FROM class_subjects cls JOIN classes c ON c.id=cls.class_id JOIN subjects s ON s.id=cls.subject_id
    WHERE cls.teacher_id=?`).all(teacher.id);
  res.render('teacher/assignments', {
    layout: false, pageTitle: 'Assignments', pageSubtitle: `${assignments.length} assignments`, nav: 'assignments',
    assignments, myClasses,
  });
});

// assignment detail with submissions
router.get('/assignments/:id', (req, res) => {
  const db = getDb();
  const assignment = db.prepare(`
    SELECT a.*, c.name as class_name, s.code as subject_code, s.name as subject_name
    FROM assignments a JOIN classes c ON c.id=a.class_id JOIN subjects s ON s.id=a.subject_id
    WHERE a.id=?`).get(req.params.id);
  if (!assignment) return res.status(404).render('errors/404', { layout: false });
  const submissions = db.prepare(`
    SELECT sub.*, u.full_name, u.avatar_color, s.roll_number
    FROM assignment_submissions sub
    JOIN students s ON s.id=sub.student_id
    JOIN users u ON u.id=s.user_id
    WHERE sub.assignment_id=?
    ORDER BY sub.submitted_at DESC
  `).all(req.params.id);
  const notSubmitted = db.prepare(`
    SELECT s.id, s.roll_number, u.full_name, u.avatar_color
    FROM class_students cs JOIN students s ON s.id=cs.student_id JOIN users u ON u.id=s.user_id
    WHERE cs.class_id=? AND s.id NOT IN (SELECT student_id FROM assignment_submissions WHERE assignment_id=?)
    ORDER BY s.roll_number
  `).all(assignment.class_id, req.params.id);
  res.render('teacher/assignment-detail', {
    layout: false, pageTitle: assignment.title, pageSubtitle: `${submissions.length} submissions`, nav: 'assignments',
    assignment, submissions, notSubmitted,
  });
});

// ============ Materials ============
router.get('/materials', (req, res) => {
  const db = getDb();
  const teacher = getTeacher(req);
  const materials = db.prepare(`
    SELECT m.*, s.code as subject_code, s.name as subject_name, c.name as class_name
    FROM study_materials m
    LEFT JOIN subjects s ON s.id=m.subject_id
    LEFT JOIN classes c ON c.id=m.class_id
    WHERE m.uploaded_by=?
    ORDER BY m.created_at DESC
  `).all(req.session.userId);
  const myClasses = db.prepare(`
    SELECT DISTINCT c.id, c.name, s.id as subject_id, s.code as subject_code, s.name as subject_name
    FROM class_subjects cls JOIN classes c ON c.id=cls.class_id JOIN subjects s ON s.id=cls.subject_id
    WHERE cls.teacher_id=?`).all(teacher.id);
  res.render('teacher/materials', {
    layout: false, pageTitle: 'Study Materials', pageSubtitle: `${materials.length} materials uploaded`, nav: 'materials',
    materials, myClasses,
  });
});

// ============ Students ============
router.get('/students', (req, res) => {
  const db = getDb();
  const teacher = getTeacher(req);
  const q = (req.query.q || '').trim();
  let sql = `
    SELECT DISTINCT s.*, u.full_name, u.email, u.avatar_color, c.name as class_name, s.roll_number,
      (SELECT COUNT(*) FROM attendance a WHERE a.student_id=s.id AND a.marked_by=?) as att_count,
      (SELECT COUNT(*) FROM attendance a WHERE a.student_id=s.id AND a.status='present' AND a.marked_by=?) as present_count
    FROM students s
    JOIN users u ON u.id=s.user_id
    JOIN class_students cs ON cs.student_id=s.id
    JOIN class_subjects cls ON cls.class_id=cs.class_id
    LEFT JOIN classes c ON c.id=cs.class_id
    WHERE cls.teacher_id=?`;
  const params = [req.session.userId, req.session.userId, teacher.id];
  if (q) { sql += ` AND (u.full_name LIKE ? OR s.roll_number LIKE ?)`; params.push('%'+q+'%','%'+q+'%'); }
  sql += ` ORDER BY s.roll_number`;
  const students = db.prepare(sql).all(...params);
  res.render('teacher/students', {
    layout: false, pageTitle: 'My Students', pageSubtitle: `${students.length} students across your classes`, nav: 'students',
    students, q,
  });
});

// ============ Notices ============
router.get('/notices', (req, res) => {
  const notices = Dashboard.allNoticesFor('teacher');
  res.render('teacher/notices', {
    layout: false, pageTitle: 'Notices', pageSubtitle: `${notices.length} announcements`, nav: 'notices',
    notices,
  });
});

// ============ Leaves ============
router.get('/leaves', (req, res) => {
  const db = getDb();
  const leaves = db.prepare(`
    SELECT * FROM leave_requests WHERE user_id=? ORDER BY created_at DESC
  `).all(req.session.userId);
  res.render('teacher/leaves', {
    layout: false, pageTitle: 'My Leaves', pageSubtitle: `${leaves.length} requests`, nav: 'leaves',
    leaves,
  });
});

module.exports = router;
