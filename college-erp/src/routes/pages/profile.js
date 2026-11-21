// Profile page routes — available to all authenticated users
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');

router.get('/', (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.*, 
      CASE WHEN u.role='student' THEN (SELECT roll_number FROM students WHERE user_id=u.id) 
           WHEN u.role='teacher' THEN (SELECT employee_id FROM teachers WHERE user_id=u.id)
           ELSE NULL END as external_id
    FROM users u WHERE u.id=?`).get(req.session.userId);
  // recent activity
  const activity = db.prepare('SELECT * FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT 10').all(req.session.userId);
  res.render('profile', {
    layout: false, pageTitle: 'My Profile', pageSubtitle: 'Manage your account', nav: '',
    user, activity, tab: req.query.tab || 'profile',
  });
});

module.exports = router;
