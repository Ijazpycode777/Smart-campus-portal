// College Management ERP — main server.
// A single-folder Node.js + Express monolith with EJS templating and SQLite.
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { getDb } = require('./db/connection');
const { migrate } = require('./db/schema');
const { seed } = require('./db/seed');
const helpers = require('./utils/helpers');

// Bootstrap DB on first run
function bootstrapDb() {
  const db = getDb();
  migrate();
  const hasAdmin = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin'").get().c;
  if (!hasAdmin) {
    console.log('  → No admin user found. Seeding database...');
    seed();
  }
}
bootstrapDb();

const app = express();

// Trust proxy (Render sits behind a proxy)
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Security headers — relaxed for inline scripts/styles in EJS
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

// Static
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// Body parsing
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Sessions
const sessionMiddleware = session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 12, // 12 hours
  },
  store: undefined, // MemoryStore in dev; for production consider connect-sqlite3 or similar
});
app.use(sessionMiddleware);

// Rate limiting — global API limit
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter rate limit on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});
app.use('/login', loginLimiter);

// Make helpers available to all EJS templates
app.locals.helpers = helpers;
app.locals.collegeName = 'College ERP';

// Inject settings + current user into every response
app.use((req, res, next) => {
  const db = getDb();
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });
  res.locals.settings = settings;
  res.locals.collegeName = settings.college_name || 'College ERP';
  res.locals.collegeShortName = settings.college_short_name || 'ERP';
  res.locals.collegeTagline = settings.college_tagline || '';
  res.locals.academicYear = settings.academic_year || '2026-2027';
  res.locals.currencySymbol = settings.currency_symbol || '₹';
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  res.locals.flash = req.session.flash || {};
  if (req.session.flash) req.session.flash = null;
  if (req.session.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
      fullName: req.session.fullName,
      avatarColor: req.session.avatarColor,
    };
    // unread notifications count
    try {
      const c = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0').get(req.session.userId).c;
      res.locals.unreadNotifications = c;
    } catch {
      res.locals.unreadNotifications = 0;
    }
  } else {
    res.locals.currentUser = null;
    res.locals.unreadNotifications = 0;
  }
  next();
});

// ============ Routes ============
app.use('/', require('./routes/pages/auth'));

// API
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/notifications', require('./routes/api/notifications'));

// Public pages
const { requireAuth, requireRole } = require('./middleware/auth');
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Admin portal
app.use('/admin', requireRole('admin'), require('./routes/pages/admin'));
app.use('/api/admin', requireRole('admin'), require('./routes/api/admin'));

// Teacher portal
app.use('/teacher', requireRole('teacher'), require('./routes/pages/teacher'));
app.use('/api/teacher', requireRole('teacher'), require('./routes/api/teacher'));

// Student portal
app.use('/student', requireRole('student'), require('./routes/pages/student'));
app.use('/api/student', requireRole('student'), require('./routes/api/student'));

// Profile (any authenticated user)
app.use('/profile', requireAuth, require('./routes/pages/profile'));

// ============ Errors ============
app.use((req, res) => {
  res.status(404).render('errors/404', { layout: false, user: res.locals.currentUser });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('errors/500', { layout: false, error: process.env.NODE_ENV === 'production' ? null : err });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  College Management ERP running on port ${PORT}`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → Login at:  http://localhost:${PORT}/login`);
  console.log(`  → Admin:     admin / admin123`);
  console.log(`  → Teacher:   prof.sharma / teacher123`);
  console.log(`  → Student:   aarav.sharma1 / student123\n`);
});

module.exports = { app, server };
