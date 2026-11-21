/* ============================================================
   College ERP — shared client-side library
   Toasts, modals, dropdowns, charts (no external deps), API helpers
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Toast ---------- */
  function toast(title, msg, type = 'info', timeout = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    const icons = {
      info: 'ℹ️', success: '✅', error: '⛔', warning: '⚠️', announcement: '📢'
    };
    t.innerHTML = `
      <div class="toast-icon" style="font-size:18px">${icons[type] || 'ℹ️'}</div>
      <div style="flex:1">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${msg ? `<div class="toast-msg">${escapeHtml(msg)}</div>` : ''}
      </div>
      <button class="toast-close" style="background:transparent;border:0;cursor:pointer;color:var(--gray-400);font-size:18px;line-height:1;padding:0 4px">×</button>
    `;
    container.appendChild(t);
    const close = () => { t.style.animation = 'toastIn .25s reverse'; setTimeout(() => t.remove(), 220); };
    t.querySelector('.toast-close').addEventListener('click', close);
    if (timeout) setTimeout(close, timeout);
  }

  /* ---------- Modal ---------- */
  function modal({ title, body, footer, size = '' }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const m = document.createElement('div');
    m.className = 'modal ' + (size === 'lg' ? 'modal-lg' : size === 'sm' ? 'modal-sm' : '');
    m.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">${title || ''}</div>
        <button class="modal-close icon-btn" style="width:32px;height:32px">×</button>
      </div>
      <div class="modal-body">${body || ''}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    `;
    overlay.appendChild(m);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    m.querySelector('.modal-close').addEventListener('click', close);
    return { overlay, m, close };
  }

  function confirmDialog(title, message, onConfirm, opts = {}) {
    const { okText = 'Confirm', cancelText = 'Cancel', okClass = 'btn-primary', danger = false } = opts;
    const { overlay, close } = modal({
      title,
      body: `<p style="margin:0;color:var(--gray-700);font-size:14px;line-height:1.6">${message}</p>`,
      footer: `<button class="btn btn-ghost" data-act="cancel">${cancelText}</button>
               <button class="btn ${danger ? 'btn-danger' : okClass}" data-act="ok">${okText}</button>`,
      size: 'sm',
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => { close(); onConfirm && onConfirm(); });
  }

  /* ---------- Dropdown ---------- */
  function initDropdowns() {
    document.querySelectorAll('[data-dropdown]').forEach(trigger => {
      trigger.addEventListener('click', e => {
        e.stopPropagation();
        const wrap = trigger.closest('.dropdown');
        document.querySelectorAll('.dropdown.open').forEach(d => { if (d !== wrap) d.classList.remove('open'); });
        wrap.classList.toggle('open');
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
    });
  }

  /* ---------- Sidebar toggle ---------- */
  function initSidebar() {
    const toggle = document.querySelector('[data-sidebar-toggle]');
    const sidebar = document.querySelector('.sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      let backdrop = document.querySelector('.sidebar-backdrop');
      if (sidebar.classList.contains('open')) {
        if (!backdrop) {
          backdrop = document.createElement('div');
          backdrop.className = 'sidebar-backdrop';
          document.body.appendChild(backdrop);
          backdrop.addEventListener('click', () => {
            sidebar.classList.remove('open');
            backdrop.remove();
          });
        }
      } else if (backdrop) backdrop.remove();
    });
  }

  /* ---------- API helper ---------- */
  async function api(url, options = {}) {
    const opts = Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    }, options);
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.body = JSON.stringify(opts.body);
    }
    if (opts.body instanceof FormData) delete opts.headers['Content-Type'];
    try {
      const res = await fetch(url, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `Request failed (${res.status})`);
        err.data = data; err.status = res.status;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.data) throw e;
      const err = new Error('Network error — please check your connection.');
      throw err;
    }
  }

  /* ---------- Form helper ---------- */
  function serializeForm(form) {
    const data = {};
    new FormData(form).forEach((v, k) => {
      if (data[k] !== undefined) {
        if (!Array.isArray(data[k])) data[k] = [data[k]];
        data[k].push(v);
      } else data[k] = v;
    });
    return data;
  }

  /* ---------- Charts (lightweight, no deps) ---------- */
  const Charts = {
    // line / area chart
    line(canvas, data, opts = {}) {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight || 220;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      const pad = { l: 36, r: 12, t: 16, b: 28 };
      const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
      const values = data.map(d => d.value);
      const labels = data.map(d => d.label);
      const max = Math.max(...values, 1) * 1.15, min = 0;
      const stepX = cw / Math.max(values.length - 1, 1);
      // grid
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; ctx.fillStyle = '#9ca3af'; ctx.font = '10px Plus Jakarta Sans';
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (ch / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        const val = Math.round(max - (max / 4) * i);
        ctx.fillText(val, 4, y + 3);
      }
      // labels
      labels.forEach((l, i) => {
        const x = pad.l + stepX * i;
        ctx.fillText(l, x - 10, H - 8);
      });
      // area gradient
      const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
      grad.addColorStop(0, opts.color || 'rgba(99,102,241,.35)');
      grad.addColorStop(1, 'rgba(99,102,241,0)');
      ctx.beginPath();
      ctx.moveTo(pad.l, pad.t + ch);
      values.forEach((v, i) => {
        const x = pad.l + stepX * i;
        const y = pad.t + ch - ((v - min) / (max - min)) * ch;
        if (i === 0) ctx.lineTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineTo(pad.l + stepX * (values.length - 1), pad.t + ch);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      // line
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = pad.l + stepX * i;
        const y = pad.t + ch - ((v - min) / (max - min)) * ch;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = opts.color || '#6366f1'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
      // dots
      values.forEach((v, i) => {
        const x = pad.l + stepX * i;
        const y = pad.t + ch - ((v - min) / (max - min)) * ch;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#fff';
        ctx.fill(); ctx.strokeStyle = opts.color || '#6366f1'; ctx.lineWidth = 2; ctx.stroke();
      });
    },

    // bar chart
    bar(canvas, data, opts = {}) {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight || 220;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      const pad = { l: 36, r: 12, t: 16, b: 36 };
      const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
      const values = data.map(d => d.value);
      const labels = data.map(d => d.label);
      const max = Math.max(...values, 1) * 1.15;
      // grid
      ctx.strokeStyle = '#e5e7eb'; ctx.fillStyle = '#9ca3af'; ctx.font = '10px Plus Jakarta Sans';
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (ch / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        ctx.fillText(Math.round(max - (max / 4) * i), 4, y + 3);
      }
      const barW = (cw / values.length) * 0.6;
      const gap = (cw / values.length) * 0.4;
      values.forEach((v, i) => {
        const x = pad.l + (cw / values.length) * i + gap / 2;
        const bh = (v / max) * ch;
        const y = pad.t + ch - bh;
        const grad = ctx.createLinearGradient(0, y, 0, y + bh);
        const c = opts.colors ? opts.colors[i % opts.colors.length] : '#6366f1';
        grad.addColorStop(0, c); grad.addColorStop(1, shade(c, -25));
        ctx.fillStyle = grad;
        roundRect(ctx, x, y, barW, bh, 6); ctx.fill();
        // label
        ctx.fillStyle = '#6b7280'; ctx.font = '10px Plus Jakarta Sans';
        const lbl = labels[i].length > 10 ? labels[i].slice(0, 9) + '…' : labels[i];
        ctx.fillText(lbl, x + barW / 2 - lbl.length * 3, H - 14);
        // value
        if (opts.showValues) { ctx.fillStyle = '#111827'; ctx.font = '600 11px Plus Jakarta Sans'; ctx.fillText(v, x + barW / 2 - String(v).length * 3, y - 5); }
      });
    },

    // donut chart
    donut(canvas, data, opts = {}) {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight || 200;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 10, ir = r * 0.62;
      const total = data.reduce((s, d) => s + d.value, 0) || 1;
      let start = -Math.PI / 2;
      const colors = opts.colors || ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4'];
      data.forEach((d, i) => {
        const angle = (d.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.arc(cx, cy, ir, start + angle, start, true);
        ctx.closePath();
        ctx.fillStyle = d.color || colors[i % colors.length];
        ctx.fill();
        start += angle;
      });
      // center text
      ctx.fillStyle = '#111827'; ctx.font = '800 22px Plus Jakarta Sans'; ctx.textAlign = 'center';
      ctx.fillText(opts.centerValue || total, cx, cy - 2);
      ctx.fillStyle = '#6b7280'; ctx.font = '10px Plus Jakarta Sans';
      ctx.fillText(opts.centerLabel || 'Total', cx, cy + 14);
      ctx.textAlign = 'left';
    },

    // progress ring (SVG-based)
    ring(svgEl, pct, opts = {}) {
      const color = opts.color || '#6366f1';
      const size = 120, stroke = 10, r = (size - stroke) / 2;
      const circ = 2 * Math.PI * r;
      const offset = circ - (Math.min(pct, 100) / 100) * circ;
      svgEl.setAttribute('viewBox', `0 0 ${size} ${size}`);
      svgEl.style.width = (opts.size || 120) + 'px'; svgEl.style.height = (opts.size || 120) + 'px';
      svgEl.innerHTML = `
        <defs><linearGradient id="rg-${Math.random().toString(36).slice(2,8)}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}"/>
          <stop offset="100%" stop-color="${shade(color, 30)}"/>
        </linearGradient></defs>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}"
          stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
          transform="rotate(-90 ${size/2} ${size/2})" style="transition:stroke-dashoffset 1s ease"/>
      `;
      const ring = svgEl.querySelector('circle:last-child');
      setTimeout(() => ring.setAttribute('stroke-dashoffset', offset), 50);
    },

    // sparkline
    spark(canvas, values, color = '#6366f1') {
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth || 100, H = canvas.clientHeight || 30;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      const max = Math.max(...values, 1), min = Math.min(...values, 0);
      const stepX = W / Math.max(values.length - 1, 1);
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = stepX * i, y = H - ((v - min) / (max - min || 1)) * (H - 4) - 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      // area
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, color + '66'); grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad; ctx.fill();
    },
  };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shade(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) + percent, g = ((num >> 8) & 0xff) + percent, b = (num & 0xff) + percent;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Notifications panel ---------- */
  async function loadNotifications() {
    try {
      const data = await api('/api/notifications');
      return data.notifications || [];
    } catch { return []; }
  }
  async function markNotificationRead(id) { return api('/api/notifications/' + id + '/read', { method: 'POST' }); }
  async function markAllRead() { return api('/api/notifications/read-all', { method: 'POST' }); }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initDropdowns();
    initSidebar();
    // Auto-hide page loader
    const loader = document.querySelector('.page-loader');
    if (loader) setTimeout(() => loader.remove(), 200);
    // Wire up notifications dropdown
    const notifTrigger = document.querySelector('[data-notif-trigger]');
    if (notifTrigger) {
      const panel = notifTrigger.closest('.dropdown').querySelector('.notif-panel');
      notifTrigger.addEventListener('click', async () => {
        if (notifTrigger.closest('.dropdown').classList.contains('open')) {
          panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400)">Loading…</div>';
          const items = await loadNotifications();
          if (!items.length) {
            panel.innerHTML = '<div class="empty" style="padding:30px 10px"><div class="empty-icon">🔔</div><div class="empty-sub">No notifications</div></div>';
            return;
          }
          const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '⛔', announcement: '📢' };
          panel.innerHTML = items.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
              <div class="notif-icon ${n.type}">${icons[n.type] || 'ℹ️'}</div>
              <div style="flex:1;min-width:0">
                <div class="notif-title">${escapeHtml(n.title)}</div>
                <div class="notif-msg">${escapeHtml(n.message)}</div>
                <div class="notif-time">${timeAgo(n.created_at)}</div>
              </div>
            </div>
          `).join('') + `<div style="padding:10px;text-align:center"><button class="btn btn-ghost btn-sm" data-mark-all>Mark all read</button></div>`;
          panel.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', async () => {
              await markNotificationRead(item.dataset.id);
              item.classList.remove('unread');
            });
          });
          const markAllBtn = panel.querySelector('[data-mark-all]');
          if (markAllBtn) markAllBtn.addEventListener('click', async () => {
            await markAllRead();
            panel.querySelectorAll('.notif-item.unread').forEach(i => i.classList.remove('unread'));
            const dot = document.querySelector('[data-notif-trigger] .dot');
            if (dot) dot.remove();
          });
        }
      });
    }
    // Render data-driven charts
    document.querySelectorAll('[data-chart]').forEach(el => {
      try {
        const type = el.getAttribute('data-chart');
        const data = JSON.parse(el.getAttribute('data-data') || '[]');
        const opts = JSON.parse(el.getAttribute('data-opts') || '{}');
        if (Charts[type]) Charts[type](el, data, opts);
      } catch (e) { console.warn('chart init failed', e); }
    });
    document.querySelectorAll('[data-ring]').forEach(el => {
      const pct = parseFloat(el.getAttribute('data-ring'));
      const color = el.getAttribute('data-ring-color') || '#6366f1';
      Charts.ring(el, pct, { color, size: parseInt(el.getAttribute('data-ring-size') || 120) });
    });
  });

  function timeAgo(s) {
    if (!s) return '';
    const d = new Date(s + (s.endsWith('Z') || s.includes('+') ? '' : 'Z'));
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    if (sec < 2592000) return Math.floor(sec / 86400) + 'd ago';
    return d.toLocaleDateString();
  }

  // expose
  window.ERP = { toast, modal, confirmDialog, api, serializeForm, Charts, escapeHtml, loadNotifications };
})();
