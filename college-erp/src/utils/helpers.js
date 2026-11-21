// Utility helpers shared across the app.
const { getDb } = require('../db/connection');

// Format currency with symbol from settings.
function formatCurrency(amount) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get('currency_symbol');
  const symbol = row ? row.value : '₹';
  const n = Number(amount || 0);
  return symbol + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// Format a date string (YYYY-MM-DD) into a readable form.
function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const day = Math.floor(hr / 24);
  if (day < 30) return day + 'd ago';
  return formatDate(dateStr);
}

// Convert marks to a letter grade.
function marksToGrade(marks, total = 100) {
  const pct = (marks / total) * 100;
  if (pct >= 90) return { grade: 'A+', gpa: 10, color: '#10b981' };
  if (pct >= 80) return { grade: 'A', gpa: 9, color: '#10b981' };
  if (pct >= 70) return { grade: 'B+', gpa: 8, color: '#3b82f6' };
  if (pct >= 60) return { grade: 'B', gpa: 7, color: '#3b82f6' };
  if (pct >= 50) return { grade: 'C', gpa: 6, color: '#f59e0b' };
  if (pct >= 40) return { grade: 'D', gpa: 5, color: '#f97316' };
  return { grade: 'F', gpa: 0, color: '#ef4444' };
}

// Initials from full name
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Escape HTML
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Audit log
function logActivity(userId, action, entityType, entityId, details, ip = null) {
  try {
    const db = getDb();
    db.prepare(`INSERT INTO activity_log(user_id, action, entity_type, entity_id, details, ip_address) VALUES (?,?,?,?,?,?)`)
      .run(userId, action, entityType, entityId || null, details || null, ip);
  } catch (e) {
    // never fail a request because of audit log
  }
}

// Send notification
function notify(userId, title, message, type = 'info', link = null) {
  try {
    const db = getDb();
    db.prepare(`INSERT INTO notifications(user_id, title, message, type, link) VALUES (?,?,?,?,?)`)
      .run(userId, title, message, type, link);
  } catch (e) {}
}

// Validate email
function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Generate a random invoice number
function generateInvoiceNumber() {
  return 'INV-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
}

// Clamp a number
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// Get current academic year
function currentAcademicYear() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='academic_year'").get();
  return row ? row.value : '2026-2027';
}

module.exports = {
  formatCurrency, formatDate, formatDateTime, timeAgo, marksToGrade,
  initials, escapeHtml, logActivity, notify, isEmail, generateInvoiceNumber,
  clamp, currentAcademicYear,
};
