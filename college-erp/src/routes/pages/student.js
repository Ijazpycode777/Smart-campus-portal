// Student portal page routes
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { Dashboard } = require('../../utils/queries');
const { formatCurrency, formatDate, timeAgo, marksToGrade, currentAcademicYear } = require('../../utils/helpers');

function getStudent(req) {
  const db = getDb();
  return db.prepare('SELECT * FROM students WHERE user_id=?').get(req.session.userId);
}

// ============ Dashboard ============
router.get('/', (req, res) => {
  const db = getDb();
  const stats = Dashboard.studentStats(req.session.userId);
  if (!stats) return res.redirect('/logout');
  const today = Dashboard.teacherTodayTimetable; // not relevant
  const notices = Dashboard.allNoticesFor('student').slice(0, 5);
  const todayTimetable = (function () {
    const st = getStudent(req);
    if (!st) return [];
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long' });
    return db.prepare(`
      SELECT t.*, s.name as subject_name, s.code as subject_code, u.full_name as teacher_name, c.name as class_name, c.room
      FROM class_students cs
      JOIN timetable t ON t.class_id=cs.class_id
      JOIN subjects s ON s.id=t.subject_id
      JOIN classes c ON c.id=t.class_id
      LEFT JOIN teachers tt ON tt.id=t.teacher_id
      LEFT JOIN users u ON u.id=tt.user_id
      WHERE cs.student_id=? AND t.day_of_week=?
      ORDER BY t.start_time
    `).all(st.id, today);
  })();
  // recent results
  const recentResults = db.prepare(`
    SELECT r.*, e.name as exam_name, e.total_marks, sub.name as subject_name, sub.code as subject_code
    FROM results r JOIN examinations e ON e.id=r.examination_id JOIN subjects sub ON sub.id=e.subject_id
    WHERE r.student_id=? ORDER BY e.id DESC LIMIT 5
  `).all(stats.student.id);
  // upcoming assignments
  const upcomingAssignments = Dashboard.studentAssignments(req.session.userId).filter(a => !a.submission_id).slice(0, 4);
  // fee status
  const feeStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM fee_invoices WHERE student_id=? GROUP BY status
  `).all(stats.student.id);
  const feeMap = {}; feeStatus.forEach(f => feeMap[f.status] = f.count);

  res.render('student/dashboard', {
    layout: false, pageTitle: 'Student Dashboard', pageSubtitle: `Welcome back, ${req.session.fullName.split(' ')[0]} 🎓`,
    nav: 'dashboard', stats, notices, todayTimetable, recentResults, upcomingAssignments, feeMap,
  });
});

// ============ Timetable ============
router.get('/timetable', (req, res) => {
  const timetable = Dashboard.studentTimetable(req.session.userId);
  // group by day
  const byDay = {};
  ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].forEach(d => byDay[d] = []);
  timetable.forEach(t => { if (byDay[t.day_of_week]) byDay[t.day_of_week].push(t); });
  res.render('student/timetable', {
    layout: false, pageTitle: 'My Timetable', pageSubtitle: 'Weekly class schedule', nav: 'timetable',
    byDay,
  });
});

// ============ Attendance ============
router.get('/attendance', (req, res) => {
  const db = getDb();
  const st = getStudent(req);
  if (!st) return res.redirect('/logout');
  // overall stats
  const overall = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN status='late' THEN 1 ELSE 0 END) as late,
      SUM(CASE WHEN status='excused' THEN 1 ELSE 0 END) as excused
    FROM attendance WHERE student_id=?`).get(st.id);
  // per-subject attendance
  const bySubject = db.prepare(`
    SELECT s.code, s.name,
      COUNT(a.id) as total,
      SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) as absent
    FROM attendance a
    JOIN subjects s ON s.id=a.subject_id
    WHERE a.student_id=?
    GROUP BY s.id ORDER BY s.code
  `).all(st.id);
  // recent records
  const recent = db.prepare(`
    SELECT a.*, s.code as subject_code, s.name as subject_name, c.name as class_name
    FROM attendance a
    JOIN subjects s ON s.id=a.subject_id
    JOIN classes c ON c.id=a.class_id
    WHERE a.student_id=?
    ORDER BY a.date DESC LIMIT 30
  `).all(st.id);
  // monthly trend (last 6 months)
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const m = d.toISOString().slice(0,7);
    const r = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present FROM attendance WHERE student_id=? AND strftime('%Y-%m', date)=?`).get(st.id, m);
    monthly.push({ month: d.toLocaleString('en-IN', { month: 'short' }), pct: r.total > 0 ? Math.round((r.present/r.total)*100) : 0 });
  }
  res.render('student/attendance', {
    layout: false, pageTitle: 'My Attendance', pageSubtitle: 'Track your presence record', nav: 'attendance',
    overall, bySubject, recent, monthly,
  });
});

// ============ Results ============
router.get('/results', (req, res) => {
  const db = getDb();
  const st = getStudent(req);
  if (!st) return res.redirect('/logout');
  const results = db.prepare(`
    SELECT r.*, e.name as exam_name, e.exam_type, e.total_marks, e.passing_marks, e.exam_date,
      sub.name as subject_name, sub.code as subject_code, sub.credits
    FROM results r
    JOIN examinations e ON e.id=r.examination_id
    JOIN subjects sub ON sub.id=e.subject_id
    WHERE r.student_id=?
    ORDER BY e.exam_date DESC
  `).all(st.id);
  // grade distribution
  const gradeDist = {};
  results.forEach(r => { gradeDist[r.grade] = (gradeDist[r.grade] || 0) + 1; });
  // GPA calc
  const totalCredits = results.reduce((a,r) => a + (r.credits || 3), 0);
  const totalPoints = results.reduce((a,r) => a + (r.credits || 3) * marksToGrade(r.marks_obtained, r.total_marks).gpa, 0);
  const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
  const avgPct = results.length ? Math.round(results.reduce((a,r) => a + (r.marks_obtained/r.total_marks)*100, 0) / results.length) : 0;
  res.render('student/results', {
    layout: false, pageTitle: 'My Results', pageSubtitle: 'Examination performance', nav: 'results',
    results, gradeDist, gpa, avgPct,
  });
});

// ============ Assignments ============
router.get('/assignments', (req, res) => {
  const assignments = Dashboard.studentAssignments(req.session.userId);
  const pending = assignments.filter(a => !a.submission_id);
  const submitted = assignments.filter(a => a.submission_id && a.marks_obtained === null);
  const graded = assignments.filter(a => a.marks_obtained !== null);
  res.render('student/assignments', {
    layout: false, pageTitle: 'Assignments', pageSubtitle: `${pending.length} pending`, nav: 'assignments',
    assignments, pending, submitted, graded,
  });
});

// ============ Materials ============
router.get('/materials', (req, res) => {
  const materials = Dashboard.studentMaterials(req.session.userId);
  res.render('student/materials', {
    layout: false, pageTitle: 'Study Materials', pageSubtitle: `${materials.length} resources`, nav: 'materials',
    materials,
  });
});

// ============ Fees ============
router.get('/fees', (req, res) => {
  const db = getDb();
  const st = getStudent(req);
  if (!st) return res.redirect('/logout');
  const invoices = db.prepare(`
    SELECT fi.*, (SELECT SUM(amount) FROM payments p WHERE p.invoice_id=fi.id) as last_payment_amount
    FROM fee_invoices fi WHERE fi.student_id=? ORDER BY fi.created_at DESC
  `).all(st.id);
  const payments = db.prepare(`
    SELECT p.*, fi.invoice_number FROM payments p
    JOIN fee_invoices fi ON fi.id=p.invoice_id
    WHERE p.student_id=? ORDER BY p.payment_date DESC
  `).all(st.id);
  const totalDue = invoices.filter(i => i.status !== 'paid').reduce((a,i) => a + (i.total_amount - i.paid_amount), 0);
  const totalPaid = invoices.reduce((a,i) => a + i.paid_amount, 0);
  const totalAll = invoices.reduce((a,i) => a + i.total_amount, 0);
  res.render('student/fees', {
    layout: false, pageTitle: 'My Fees', pageSubtitle: 'Invoices & payments', nav: 'fees',
    invoices, payments, totalDue, totalPaid, totalAll,
  });
});

// ============ Notices ============
router.get('/notices', (req, res) => {
  const notices = Dashboard.allNoticesFor('student');
  res.render('student/notices', {
    layout: false, pageTitle: 'Notices', pageSubtitle: `${notices.length} announcements`, nav: 'notices',
    notices,
  });
});

// ============ Leaves ============
router.get('/leaves', (req, res) => {
  const db = getDb();
  const leaves = db.prepare(`SELECT * FROM leave_requests WHERE user_id=? ORDER BY created_at DESC`).all(req.session.userId);
  res.render('student/leaves', {
    layout: false, pageTitle: 'Leave Requests', pageSubtitle: `${leaves.length} requests`, nav: 'leaves',
    leaves,
  });
});

// ============ Notifications ============
router.get('/notifications', (req, res) => {
  const db = getDb();
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC').all(req.session.userId);
  res.render('student/notifications', {
    layout: false, pageTitle: 'Notifications', pageSubtitle: `${notifications.length} total`, nav: 'dashboard',
    notifications,
  });
});

module.exports = router;
