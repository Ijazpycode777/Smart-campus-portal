// API: auth — password change, profile update
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { requireAuth } = require('../../middleware/auth');
const { hashPassword, verifyPassword } = require('../../middleware/auth');
const { isEmail, logActivity } = require('../../utils/helpers');

router.use(requireAuth);

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  const db = getDb();
  const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.session.userId);
  if (!verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?").run(hashPassword(newPassword), req.session.userId);
  logActivity(req.session.userId, 'password_change', 'user', req.session.userId, 'password changed');
  res.json({ ok: true, message: 'Password changed successfully.' });
});

// PUT /api/auth/profile
router.put('/profile', (req, res) => {
  const { full_name, phone, email } = req.body || {};
  if (!full_name || !email) return res.status(400).json({ error: 'Name and email are required.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email format.' });
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email=? AND id != ?').get(email, req.session.userId);
  if (existing) return res.status(400).json({ error: 'Email already in use.' });
  db.prepare("UPDATE users SET full_name=?, email=?, phone=?, updated_at=datetime('now') WHERE id=?")
    .run(full_name, email, phone || null, req.session.userId);
  req.session.fullName = full_name;
  logActivity(req.session.userId, 'profile_update', 'user', req.session.userId, 'profile updated');
  res.json({ ok: true, message: 'Profile updated successfully.' });
});

module.exports = router;
