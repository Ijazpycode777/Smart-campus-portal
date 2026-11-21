// API: Student — fees, assignments, leaves, profile-restricted data
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { logActivity, notify, currentAcademicYear } = require('../../utils/helpers');

function getStudent(req) {
  const db = getDb();
  return db.prepare('SELECT * FROM students WHERE user_id=?').get(req.session.userId);
}

// POST /api/student/fees/:invoiceId/pay — student initiates a payment
router.post('/fees/:invoiceId/pay', (req, res) => {
  const b = req.body || {};
  if (!b.amount) return res.status(400).json({ error: 'Amount required' });
  const st = getStudent(req);
  if (!st) return res.status(403).json({ error: 'Student profile not found' });
  const db = getDb();
  const tx = db.transaction(() => {
    const inv = db.prepare('SELECT * FROM fee_invoices WHERE id=? AND student_id=?').get(req.params.invoiceId, st.id);
    if (!inv) throw new Error('Invoice not found or does not belong to you');
    if (inv.status === 'paid') throw new Error('Invoice already paid');
    const amount = Math.min(Number(b.amount), inv.total_amount - inv.paid_amount);
    const newPaid = inv.paid_amount + amount;
    const status = newPaid >= inv.total_amount ? 'paid' : 'partially_paid';
    db.prepare('UPDATE fee_invoices SET paid_amount=?, status=? WHERE id=?').run(newPaid, status, inv.id);
    const p = db.prepare(`INSERT INTO payments(invoice_id, student_id, amount, payment_method, transaction_id, recorded_by) VALUES (?,?,?,?,?,?)`)
      .run(inv.id, st.id, amount, b.payment_method || 'Online Banking', 'TXN' + Date.now(), req.session.userId);
    logActivity(req.session.userId, 'payment', 'invoice', inv.id, `Payment ₹${amount} for ${inv.invoice_number}`);
    // notify admins about the payment
    const admins = db.prepare("SELECT id FROM users WHERE role='admin'").all();
    admins.forEach(a => notify(a.id, 'Payment Received', `${req.session.fullName} paid ₹${amount} against ${inv.invoice_number}.`, 'success', '/admin/fees'));
    return p.lastInsertRowid;
  });
  try { tx(); res.json({ ok: true, message: 'Payment successful.' }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/student/assignments/:id/submit
router.post('/assignments/:id/submit', (req, res) => {
  const b = req.body || {};
  const st = getStudent(req);
  if (!st) return res.status(403).json({ error: 'Student profile not found' });
  const db = getDb();
  const assign = db.prepare('SELECT * FROM assignments WHERE id=?').get(req.params.id);
  if (!assign) return res.status(404).json({ error: 'Assignment not found' });
  // verify student is in the class
  const enrolled = db.prepare('SELECT 1 FROM class_students WHERE class_id=? AND student_id=?').get(assign.class_id, st.id);
  if (!enrolled) return res.status(403).json({ error: 'You are not enrolled in this class' });
  db.prepare(`INSERT OR REPLACE INTO assignment_submissions(assignment_id, student_id, submission_text, file_url) VALUES (?,?,?,?)`)
    .run(assign.id, st.id, b.submission_text || null, b.file_url || null);
  // notify teacher
  if (assign.teacher_id) {
    const t = db.prepare('SELECT user_id FROM teachers WHERE id=?').get(assign.teacher_id);
    if (t) notify(t.user_id, 'Assignment Submitted', `${req.session.fullName} submitted "${assign.title}".`, 'info', '/teacher/assignments');
  }
  logActivity(req.session.userId, 'submit', 'assignment', assign.id, `Submitted ${assign.title}`);
  res.json({ ok: true, message: 'Assignment submitted successfully.' });
});

// POST /api/student/leave-requests
router.post('/leave-requests', (req, res) => {
  const b = req.body || {};
  if (!b.start_date || !b.end_date || !b.reason) return res.status(400).json({ error: 'start, end, reason required' });
  const db = getDb();
  const r = db.prepare(`INSERT INTO leave_requests(user_id, leave_type, start_date, end_date, reason) VALUES (?,?,?,?,?)`)
    .run(req.session.userId, b.leave_type || 'Casual', b.start_date, b.end_date, b.reason);
  const admins = db.prepare("SELECT id FROM users WHERE role='admin'").all();
  admins.forEach(a => notify(a.id, 'New Leave Request', `${req.session.fullName} requested leave (${b.start_date} → ${b.end_date}).`, 'info', '/admin/leaves'));
  res.json({ ok: true, id: r.lastInsertRowid });
});

module.exports = router;
