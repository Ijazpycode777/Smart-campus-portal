// API: notifications — list, mark read, delete
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

// GET /api/notifications
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.session.userId);
  res.json({ notifications: rows });
});

// POST /api/notifications/:id/read
router.post('/:id/read', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

// POST /api/notifications/read-all
router.post('/read-all', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.session.userId);
  res.json({ ok: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
