// Auth routes — single login page handles admin/teacher/student authentication.
const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const { verifyPassword, hashPassword } = require('../../middleware/auth');
const { logActivity } = require('../../utils/helpers');

// GET /login
router.get('/login', (req, res) => {
  if (req.session.userId) {
    const role = req.session.role;
    return res.redirect(role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student');
  }
  res.render('auth/login', { layout: false, error: null, redirect: req.query.redirect || '' });
});

// POST /login
router.post('/login', (req, res) => {
  const { username, password, redirect } = req.body || {};
  if (!username || !password) {
    return res.status(400).render('auth/login', { layout: false, error: 'Please enter both username and password.', redirect: redirect || '' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username.trim(), username.trim());
  if (!user) {
    logActivity(null, 'login_failed', 'user', null, `unknown username: ${username}`, req.ip);
    return res.status(401).render('auth/login', { layout: false, error: 'Invalid username or password.', redirect: redirect || '' });
  }
  if (!user.is_active) {
    return res.status(403).render('auth/login', { layout: false, error: 'Your account has been deactivated. Contact the administrator.', redirect: redirect || '' });
  }
  if (!verifyPassword(password, user.password_hash)) {
    logActivity(user.id, 'login_failed', 'user', user.id, 'wrong password', req.ip);
    return res.status(401).render('auth/login', { layout: false, error: 'Invalid username or password.', redirect: redirect || '' });
  }
  // success — create session
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  req.session.fullName = user.full_name;
  req.session.avatarColor = user.avatar_color;
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  logActivity(user.id, 'login_success', 'user', user.id, `${user.role} login`, req.ip);

  let target = role => role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student';
  const dest = redirect && /^\/(admin|teacher|student)/.test(redirect) ? redirect : target(user.role);
  res.redirect(dest);
});

// GET /logout
router.get('/logout', (req, res) => {
  if (req.session) {
    logActivity(req.session.userId, 'logout', 'user', req.session.userId, `${req.session.role} logout`);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
});

// GET / — redirect to portal or login
router.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const r = req.session.role;
  res.redirect(r === 'admin' ? '/admin' : r === 'teacher' ? '/teacher' : '/student');
});

module.exports = router;
