// API: Admin — full CRUD for all entities
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { hashPassword } = require('../../middleware/auth');
const { logActivity, notify, generateInvoiceNumber, currentAcademicYear } = require('../../utils/helpers');

// ===== STUDENTS =====
router.post('/students', (req, res) => {
  const b = req.body || {};
  if (!b.full_name || !b.username || !b.email || !b.roll_number) {
    return res.status(400).json({ error: 'Name, username, email and roll number are required.' });
  }
  const db = getDb();
  const tx = db.transaction(() => {
    const exists = db.prepare('SELECT id FROM users WHERE username=? OR email=?').get(b.username, b.email);
    if (exists) throw new Error('Username or email already exists');
    const rollExists = db.prepare('SELECT id FROM students WHERE roll_number=?').get(b.roll_number);
    if (rollExists) throw new Error('Roll number already exists');
    const colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6'];
    const userRes = db.prepare(`INSERT INTO users(username,email,password_hash,role,full_name,phone,avatar_color) VALUES (?,?,?,?,?,?,?)`)
      .run(b.username, b.email, hashPassword(b.password || 'student123'), 'student', b.full_name, b.phone || null, colors[Math.floor(Math.random()*colors.length)]);
    const stRes = db.prepare(`INSERT INTO students(user_id, roll_number, course_id, department_id, current_semester, current_section, admission_date, batch_year, guardian_name, guardian_phone, address, blood_group, gender, dob) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(userRes.lastInsertRowid, b.roll_number, b.course_id || null, b.department_id || null, b.current_semester || 1, b.current_section || null, b.admission_date || new Date().toISOString().slice(0,10), b.batch_year || new Date().getFullYear(), b.guardian_name || null, b.guardian_phone || null, b.address || null, b.blood_group || null, b.gender || null, b.dob || null);
    if (b.class_id) db.prepare('INSERT OR IGNORE INTO class_students(class_id, student_id) VALUES (?,?)').run(b.class_id, stRes.lastInsertRowid);
    logActivity(req.session.userId, 'create', 'student', stRes.lastInsertRowid, `Created student ${b.full_name} (${b.roll_number})`, req.ip);
    return stRes.lastInsertRowid;
  });
  try {
    const id = tx();
    res.json({ ok: true, id, message: 'Student created successfully.' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/students/:id', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const st = db.prepare('SELECT user_id FROM students WHERE id=?').get(req.params.id);
  if (!st) return res.status(404).json({ error: 'Student not found' });
  const tx = db.transaction(() => {
    db.prepare(`UPDATE users SET full_name=?, phone=?, updated_at=datetime('now') WHERE id=?`).run(b.full_name, b.phone || null, st.user_id);
    db.prepare(`UPDATE students SET roll_number=?, course_id=?, department_id=?, current_semester=?, current_section=?, guardian_name=?, guardian_phone=?, address=?, blood_group=?, gender=?, dob=?, status=? WHERE id=?`)
      .run(b.roll_number, b.course_id, b.department_id, b.current_semester, b.current_section, b.guardian_name, b.guardian_phone, b.address, b.blood_group, b.gender, b.dob, b.status || 'active', req.params.id);
    logActivity(req.session.userId, 'update', 'student', req.params.id, `Updated student ${b.full_name}`);
  });
  tx();
  res.json({ ok: true, message: 'Student updated successfully.' });
});

router.delete('/students/:id', (req, res) => {
  const db = getDb();
  const st = db.prepare('SELECT user_id, roll_number FROM students WHERE id=?').get(req.params.id);
  if (!st) return res.status(404).json({ error: 'Student not found' });
  db.prepare('DELETE FROM users WHERE id=?').run(st.user_id); // cascades to students
  logActivity(req.session.userId, 'delete', 'student', req.params.id, `Deleted student ${st.roll_number}`);
  res.json({ ok: true });
});

// ===== TEACHERS =====
router.post('/teachers', (req, res) => {
  const b = req.body || {};
  if (!b.full_name || !b.username || !b.email || !b.employee_id) {
    return res.status(400).json({ error: 'Name, username, email and employee ID are required.' });
  }
  const db = getDb();
  const tx = db.transaction(() => {
    const exists = db.prepare('SELECT id FROM users WHERE username=? OR email=?').get(b.username, b.email);
    if (exists) throw new Error('Username or email already exists');
    const empExists = db.prepare('SELECT id FROM teachers WHERE employee_id=?').get(b.employee_id);
    if (empExists) throw new Error('Employee ID already exists');
    const colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6'];
    const userRes = db.prepare(`INSERT INTO users(username,email,password_hash,role,full_name,phone,avatar_color) VALUES (?,?,?,?,?,?,?)`)
      .run(b.username, b.email, hashPassword(b.password || 'teacher123'), 'teacher', b.full_name, b.phone || null, colors[Math.floor(Math.random()*colors.length)]);
    const tRes = db.prepare(`INSERT INTO teachers(user_id, employee_id, department_id, designation, qualification, specialization, join_date, salary, experience_years) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(userRes.lastInsertRowid, b.employee_id, b.department_id || null, b.designation || 'Assistant Professor', b.qualification || null, b.specialization || null, b.join_date || new Date().toISOString().slice(0,10), b.salary || 0, b.experience_years || 0);
    logActivity(req.session.userId, 'create', 'teacher', tRes.lastInsertRowid, `Created teacher ${b.full_name} (${b.employee_id})`);
    return tRes.lastInsertRowid;
  });
  try {
    const id = tx();
    res.json({ ok: true, id, message: 'Teacher created successfully.' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/teachers/:id', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const t = db.prepare('SELECT user_id FROM teachers WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Teacher not found' });
  db.transaction(() => {
    db.prepare(`UPDATE users SET full_name=?, phone=?, updated_at=datetime('now') WHERE id=?`).run(b.full_name, b.phone || null, t.user_id);
    db.prepare(`UPDATE teachers SET department_id=?, designation=?, qualification=?, specialization=?, salary=?, experience_years=? WHERE id=?`)
      .run(b.department_id, b.designation, b.qualification, b.specialization, b.salary, b.experience_years, req.params.id);
    logActivity(req.session.userId, 'update', 'teacher', req.params.id, `Updated teacher ${b.full_name}`);
  })();
  res.json({ ok: true, message: 'Teacher updated successfully.' });
});

router.delete('/teachers/:id', (req, res) => {
  const db = getDb();
  const t = db.prepare('SELECT user_id, employee_id FROM teachers WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Teacher not found' });
  db.prepare('DELETE FROM users WHERE id=?').run(t.user_id);
  logActivity(req.session.userId, 'delete', 'teacher', req.params.id, `Deleted teacher ${t.employee_id}`);
  res.json({ ok: true });
});

// ===== CLASSES =====
router.post('/classes', (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Class name is required.' });
  const db = getDb();
  const res2 = db.prepare(`INSERT INTO classes(name, course_id, semester, section, class_teacher_id, room, academic_year, capacity) VALUES (?,?,?,?,?,?,?,?)`)
    .run(b.name, b.course_id, b.semester || 1, b.section, b.class_teacher_id || null, b.room, b.academic_year || currentAcademicYear(), b.capacity || 60);
  logActivity(req.session.userId, 'create', 'class', res2.lastInsertRowid, `Created class ${b.name}`);
  res.json({ ok: true, id: res2.lastInsertRowid });
});

router.put('/classes/:id', (req, res) => {
  const b = req.body || {};
  const db = getDb();
  db.prepare(`UPDATE classes SET name=?, course_id=?, semester=?, section=?, class_teacher_id=?, room=?, capacity=? WHERE id=?`)
    .run(b.name, b.course_id, b.semester, b.section, b.class_teacher_id, b.room, b.capacity, req.params.id);
  res.json({ ok: true });
});

router.delete('/classes/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM classes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// enroll students into a class
router.post('/classes/:id/enroll', (req, res) => {
  const db = getDb();
  const studentIds = Array.isArray(req.body.student_ids) ? req.body.student_ids : [req.body.student_ids];
  const stmt = db.prepare('INSERT OR IGNORE INTO class_students(class_id, student_id) VALUES (?,?)');
  db.transaction(() => studentIds.forEach(sid => stmt.run(req.params.id, sid)))();
  res.json({ ok: true, count: studentIds.length });
});

// ===== FEE INVOICES =====
router.post('/fees/invoice', (req, res) => {
  const b = req.body || {};
  if (!b.student_id || !b.total_amount) return res.status(400).json({ error: 'Student and amount required' });
  const db = getDb();
  const invNo = generateInvoiceNumber();
  const r = db.prepare(`INSERT INTO fee_invoices(invoice_number, student_id, semester, academic_year, total_amount, paid_amount, due_date, status, remarks) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(invNo, b.student_id, b.semester, b.academic_year || currentAcademicYear(), b.total_amount, 0, b.due_date, 'unpaid', b.remarks || null);
  const st = db.prepare('SELECT user_id FROM students WHERE id=?').get(b.student_id);
  if (st) notify(st.user_id, 'New Fee Invoice', `Invoice ${invNo} for ${currentAcademicYear()} has been generated. Amount: ₹${b.total_amount}.`, 'warning', '/student/fees');
  logActivity(req.session.userId, 'create', 'fee_invoice', r.lastInsertRowid, `Invoice ${invNo} created`);
  res.json({ ok: true, id: r.lastInsertRowid, invoice_number: invNo });
});

router.post('/fees/payment', (req, res) => {
  const b = req.body || {};
  if (!b.invoice_id || !b.amount) return res.status(400).json({ error: 'Invoice and amount required' });
  const db = getDb();
  const tx = db.transaction(() => {
    const inv = db.prepare('SELECT * FROM fee_invoices WHERE id=?').get(b.invoice_id);
    if (!inv) throw new Error('Invoice not found');
    const newPaid = inv.paid_amount + Number(b.amount);
    const status = newPaid >= inv.total_amount ? 'paid' : 'partially_paid';
    db.prepare('UPDATE fee_invoices SET paid_amount=?, status=? WHERE id=?').run(newPaid, status, b.invoice_id);
    const p = db.prepare(`INSERT INTO payments(invoice_id, student_id, amount, payment_method, transaction_id, recorded_by) VALUES (?,?,?,?,?,?)`)
      .run(b.invoice_id, inv.student_id, b.amount, b.payment_method || 'Cash', b.transaction_id || null, req.session.userId);
    const st = db.prepare('SELECT user_id FROM students WHERE id=?').get(inv.student_id);
    if (st) notify(st.user_id, 'Payment Received', `Payment of ₹${b.amount} recorded against invoice ${inv.invoice_number}.`, 'success', '/student/fees');
    logActivity(req.session.userId, 'create', 'payment', p.lastInsertRowid, `Payment ₹${b.amount} for invoice ${inv.invoice_number}`);
    return p.lastInsertRowid;
  });
  try { tx(); res.json({ ok: true, message: 'Payment recorded successfully.' }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// ===== NOTICES =====
router.post('/notices', (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.content) return res.status(400).json({ error: 'Title and content required' });
  const db = getDb();
  const r = db.prepare(`INSERT INTO notices(title, content, category, target_audience, priority, posted_by, is_pinned, expires_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(b.title, b.content, b.category || 'general', b.target_audience || 'all', b.priority || 'normal', req.session.userId, b.is_pinned ? 1 : 0, b.expires_at || null);
  // notify target users
  let targetRows = [];
  if (b.target_audience === 'all') targetRows = db.prepare("SELECT id FROM users WHERE is_active=1").all();
  else targetRows = db.prepare("SELECT id FROM users WHERE role=? AND is_active=1").all(b.target_audience);
  targetRows.forEach(u => notify(u.id, b.title, b.content.slice(0, 200), 'announcement', null));
  logActivity(req.session.userId, 'create', 'notice', r.lastInsertRowid, `Notice: ${b.title}`);
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.put('/notices/:id', (req, res) => {
  const b = req.body || {};
  const db = getDb();
  db.prepare(`UPDATE notices SET title=?, content=?, category=?, target_audience=?, priority=?, is_pinned=? WHERE id=?`)
    .run(b.title, b.content, b.category, b.target_audience, b.priority, b.is_pinned ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/notices/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM notices WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ===== STUDY MATERIALS =====
router.post('/materials', (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'Title required' });
  const db = getDb();
  const r = db.prepare(`INSERT INTO study_materials(title, description, subject_id, class_id, uploaded_by, material_type, file_url, file_size) VALUES (?,?,?,?,?,?,?,?)`)
    .run(b.title, b.description || null, b.subject_id || null, b.class_id || null, req.session.userId, b.material_type || 'document', b.file_url || null, b.file_size || 0);
  // notify class students
  if (b.class_id) {
    const students = db.prepare('SELECT s.user_id FROM class_students cs JOIN students s ON s.id = cs.student_id WHERE cs.class_id=?').all(b.class_id);
    students.forEach(s => notify(s.user_id, 'New Study Material', `${b.title} has been uploaded.`, 'info', '/student/materials'));
  }
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.delete('/materials/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM study_materials WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ===== SETTINGS =====
router.put('/settings', (req, res) => {
  const db = getDb();
  const tx = db.transaction(() => {
    Object.entries(req.body).forEach(([k, v]) => {
      db.prepare('INSERT INTO settings(key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
    });
  });
  tx();
  logActivity(req.session.userId, 'update', 'settings', null, 'Settings updated');
  res.json({ ok: true });
});

// ===== USERS toggle active =====
router.post('/users/:id/toggle-active', (req, res) => {
  const db = getDb();
  const u = db.prepare('SELECT is_active, role FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.role === 'admin' && req.params.id != req.session.userId) {
    // don't deactivate other admins accidentally
  }
  db.prepare('UPDATE users SET is_active = 1 - is_active WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ===== TIMETABLE =====
router.post('/timetable', (req, res) => {
  const b = req.body || {};
  const db = getDb();
  db.prepare(`INSERT INTO timetable(class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room) VALUES (?,?,?,?,?,?,?)`)
    .run(b.class_id, b.subject_id, b.teacher_id, b.day_of_week, b.start_time, b.end_time, b.room);
  res.json({ ok: true });
});

router.delete('/timetable/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM timetable WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
