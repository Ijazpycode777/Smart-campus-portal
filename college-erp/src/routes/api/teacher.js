// API: Teacher — attendance, grades, materials, assignments, leaves
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { logActivity, notify, marksToGrade, currentAcademicYear } = require('../../utils/helpers');

// Get the teacher record for the current user
function getTeacher(req) {
  const db = getDb();
  return db.prepare('SELECT * FROM teachers WHERE user_id=?').get(req.session.userId);
}

// ===== ATTENDANCE =====
// POST /api/teacher/attendance — bulk mark attendance for a class+subject+date
router.post('/attendance', (req, res) => {
  const b = req.body || {};
  if (!b.class_id || !b.subject_id || !b.date || !Array.isArray(b.records)) {
    return res.status(400).json({ error: 'class_id, subject_id, date and records are required.' });
  }
  const teacher = getTeacher(req);
  if (!teacher) return res.status(403).json({ error: 'Teacher profile not found.' });
  const db = getDb();
  const stmt = db.prepare(`INSERT OR REPLACE INTO attendance(class_id, subject_id, student_id, date, status, marked_by, remarks) VALUES (?,?,?,?,?,?,?)`);
  const tx = db.transaction(() => {
    b.records.forEach(r => {
      stmt.run(b.class_id, b.subject_id, r.student_id, b.date, r.status, req.session.userId, r.remarks || null);
    });
    // notify absent students
    const absent = b.records.filter(r => r.status === 'absent');
    absent.forEach(r => {
      const st = db.prepare('SELECT user_id FROM students WHERE id=?').get(r.student_id);
      if (st) notify(st.user_id, 'Attendance Marked Absent', `You were marked absent in ${b.subject_id} on ${b.date}.`, 'warning', '/student/attendance');
    });
    logActivity(req.session.userId, 'create', 'attendance', null, `Marked attendance for class ${b.class_id} on ${b.date}`, req.ip);
  });
  tx();
  res.json({ ok: true, count: b.records.length, message: `Attendance recorded for ${b.records.length} students.` });
});

// ===== EXAMINATIONS + RESULTS =====
router.post('/examinations', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.class_id || !b.subject_id) return res.status(400).json({ error: 'name, class_id, subject_id required' });
  const teacher = getTeacher(req);
  const db = getDb();
  const r = db.prepare(`INSERT INTO examinations(name, exam_type, class_id, subject_id, total_marks, passing_marks, exam_date, academic_year, created_by) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(b.name, b.exam_type || 'midterm', b.class_id, b.subject_id, b.total_marks || 100, b.passing_marks || 40, b.exam_date, b.academic_year || currentAcademicYear(), req.session.userId);
  logActivity(req.session.userId, 'create', 'examination', r.lastInsertRowid, `Exam: ${b.name}`);
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.post('/examinations/:id/results', (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.results)) return res.status(400).json({ error: 'results array required' });
  const db = getDb();
  const exam = db.prepare('SELECT * FROM examinations WHERE id=?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Examination not found' });
  const stmt = db.prepare(`INSERT OR REPLACE INTO results(examination_id, student_id, marks_obtained, grade, remarks, created_by) VALUES (?,?,?,?,?,?)`);
  const tx = db.transaction(() => {
    b.results.forEach(r => {
      const g = marksToGrade(r.marks_obtained, exam.total_marks);
      stmt.run(exam.id, r.student_id, r.marks_obtained, g.grade, r.remarks || null, req.session.userId);
      const st = db.prepare('SELECT user_id FROM students WHERE id=?').get(r.student_id);
      if (st) notify(st.user_id, 'Examination Result Published', `Your result for "${exam.name}" has been published. Marks: ${r.marks_obtained}/${exam.total_marks} (Grade: ${g.grade}).`, g.grade === 'F' ? 'error' : 'success', '/student/results');
    });
    logActivity(req.session.userId, 'create', 'result', exam.id, `Results for ${exam.name}`);
  });
  tx();
  res.json({ ok: true, count: b.results.length });
});

router.delete('/examinations/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM examinations WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ===== ASSIGNMENTS =====
router.post('/assignments', (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.class_id || !b.subject_id) return res.status(400).json({ error: 'title, class_id, subject_id required' });
  const teacher = getTeacher(req);
  const db = getDb();
  const r = db.prepare(`INSERT INTO assignments(title, description, class_id, subject_id, teacher_id, due_date, total_marks) VALUES (?,?,?,?,?,?,?)`)
    .run(b.title, b.description || null, b.class_id, b.subject_id, teacher ? teacher.id : null, b.due_date, b.total_marks || 100);
  const students = db.prepare('SELECT s.user_id FROM class_students cs JOIN students s ON s.id=cs.student_id WHERE cs.class_id=?').all(b.class_id);
  students.forEach(s => notify(s.user_id, 'New Assignment', `${b.title} — due ${b.due_date || 'soon'}.`, 'info', '/student/assignments'));
  logActivity(req.session.userId, 'create', 'assignment', r.lastInsertRowid, `Assignment: ${b.title}`);
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.put('/assignments/:id', (req, res) => {
  const b = req.body || {};
  const db = getDb();
  db.prepare(`UPDATE assignments SET title=?, description=?, due_date=?, total_marks=? WHERE id=?`)
    .run(b.title, b.description, b.due_date, b.total_marks, req.params.id);
  res.json({ ok: true });
});

router.delete('/assignments/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM assignments WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Grade a submission
router.post('/assignments/submissions/:id/grade', (req, res) => {
  const b = req.body || {};
  const db = getDb();
  const sub = db.prepare('SELECT * FROM assignment_submissions WHERE id=?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  db.prepare(`UPDATE assignment_submissions SET marks_obtained=?, feedback=?, graded_by=?, graded_at=datetime('now') WHERE id=?`)
    .run(b.marks_obtained, b.feedback || null, req.session.userId, req.params.id);
  const st = db.prepare('SELECT user_id FROM students WHERE id=?').get(sub.student_id);
  if (st) notify(st.user_id, 'Assignment Graded', `Your submission has been graded. Marks: ${b.marks_obtained}.`, 'info', '/student/assignments');
  res.json({ ok: true });
});

// ===== STUDY MATERIALS =====
router.post('/materials', (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Title required' });
  const db = getDb();
  const r = db.prepare(`INSERT INTO study_materials(title, description, subject_id, class_id, uploaded_by, material_type, file_url, file_size) VALUES (?,?,?,?,?,?,?,?)`)
    .run(b.title, b.description || null, b.subject_id || null, b.class_id || null, req.session.userId, b.material_type || 'document', b.file_url || null, b.file_size || 0);
  if (b.class_id) {
    const students = db.prepare('SELECT s.user_id FROM class_students cs JOIN students s ON s.id=cs.student_id WHERE cs.class_id=?').all(b.class_id);
    students.forEach(s => notify(s.user_id, 'New Study Material', `${b.title} has been uploaded.`, 'info', '/student/materials'));
  }
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.delete('/materials/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM study_materials WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ===== LEAVE REQUESTS =====
router.post('/leave-requests', (req, res) => {
  const b = req.body || {};
  if (!b.start_date || !b.end_date || !b.reason) return res.status(400).json({ error: 'start, end and reason required' });
  const db = getDb();
  const r = db.prepare(`INSERT INTO leave_requests(user_id, leave_type, start_date, end_date, reason) VALUES (?,?,?,?,?)`)
    .run(req.session.userId, b.leave_type || 'Casual', b.start_date, b.end_date, b.reason);
  // notify admins
  const admins = db.prepare("SELECT id FROM users WHERE role='admin'").all();
  admins.forEach(a => notify(a.id, 'New Leave Request', `${req.session.fullName} requested leave from ${b.start_date} to ${b.end_date}.`, 'info', '/admin/leaves'));
  res.json({ ok: true, id: r.lastInsertRowid });
});

module.exports = router;
