// Authentication & role-based access control middleware.
const bcrypt = require('bcryptjs');

// Require an authenticated session.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
      fullName: req.session.fullName,
      avatarColor: req.session.avatarColor,
    };
    return next();
  }
  if (req.path && req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
}

// Require a specific role (or one of several).
function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.session || !req.session.userId) {
      if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Authentication required' });
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.role)) {
      if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Forbidden: insufficient privileges' });
      return res.status(403).render('errors/403', {
        layout: false,
        message: `This area is restricted to: ${roles.join(', ')}.`,
        userRole: req.session.role,
      });
    }
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
      fullName: req.session.fullName,
      avatarColor: req.session.avatarColor,
    };
    next();
  };
}

// Verify password
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Hash password
function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

module.exports = { requireAuth, requireRole, verifyPassword, hashPassword };
