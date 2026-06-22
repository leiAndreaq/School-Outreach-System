// ── HISTORY PAGINATION STATE ──
// page size is dynamic — see calcPageSize() in app.js
let historyCurrentPage   = 1;
let historyAllList       = [];

// ── LOAD DELETION HISTORY ──
async function loadHistory() {
  try {
    const res     = await fetch('/api/deletion-history');
    historyAllList    = await res.json();
    historyCurrentPage = 1;
    renderHistory();
  } catch (e) {
    showToast('Could not load deletion history', 'error');
  }
}

// ── RENDER HISTORY PAGE ──
function renderHistory() {
  const tbody = document.getElementById('historyTable');
  const total = historyAllList.length;

  if (!total) {
    tbody.innerHTML = emptyState(
      'archive',
      'No deletion history yet',
      'Deleted records will appear here'
    );
    const pg = document.getElementById('historyPagination');
    if (pg) pg.style.display = 'none';
    lucide.createIcons();
    return;
  }

  const pageSize   = calcPageSize(52, 310);
  const totalPages = Math.ceil(total / pageSize);
  if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;

  const start = (historyCurrentPage - 1) * pageSize;
  const page  = historyAllList.slice(start, start + pageSize);

  tbody.innerHTML = page.map(r => `
    <tr>
      <td>
        <span class="badge ${r.record_type === 'SCHOOL'
          ? 'badge-new' : 'badge-default'}">
          ${r.record_type}
        </span>
      </td>
      <td>${r.record_name}</td>
      <td>${r.reason || '—'}</td>
      <td>${formatHistoryDate(r.deleted_at)}</td>
    </tr>
  `).join('');
  lucide.createIcons();

  renderHistoryPagination(total, totalPages);
}

// ── RENDER HISTORY PAGINATION ──
function renderHistoryPagination(total, totalPages) {
  const pg = document.getElementById('historyPagination');
  if (!pg) return;

  if (totalPages <= 1) {
    pg.style.display = 'none';
    return;
  }

  pg.style.display = 'flex';

  const MAX_VISIBLE = 5;
  let winStart = Math.max(1, historyCurrentPage - Math.floor(MAX_VISIBLE / 2));
  let winEnd   = winStart + MAX_VISIBLE - 1;
  if (winEnd > totalPages) {
    winEnd   = totalPages;
    winStart = Math.max(1, winEnd - MAX_VISIBLE + 1);
  }

  const btnStyle = (active) =>
    `style="min-width:30px; height:30px; padding:0 8px; border-radius:6px; border:1px solid ${active ? '#1B1F6B' : '#e5e7eb'}; background:${active ? '#1B1F6B' : '#fff'}; color:${active ? '#fff' : '#374151'}; font-size:12px; font-weight:600; cursor:${active ? 'default' : 'pointer'};"`;

  const navBtn = (label, onclick, disabled) =>
    `<button onclick="${onclick}" ${disabled ? 'disabled' : ''} style="min-width:30px; height:30px; padding:0 8px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; color:${disabled ? '#d1d5db' : '#374151'}; font-size:12px; font-weight:700; cursor:${disabled ? 'default' : 'pointer'};">${label}</button>`;

  const pageButtons = [];
  for (let i = winStart; i <= winEnd; i++) {
    const isActive = i === historyCurrentPage;
    pageButtons.push(
      `<button onclick="goToHistoryPage(${i})" ${isActive ? 'disabled' : ''} ${btnStyle(isActive)}>${i}</button>`
    );
  }

  const pageSize = calcPageSize(52, 310);
  const startIdx = (historyCurrentPage - 1) * pageSize + 1;
  const endIdx   = Math.min(historyCurrentPage * pageSize, total);

  pg.innerHTML = `
    <div style="display:flex; gap:4px; align-items:center;">
      ${navBtn('«', 'goToHistoryPage(1)', historyCurrentPage === 1)}
      ${navBtn('‹', `goToHistoryPage(${historyCurrentPage - 1})`, historyCurrentPage === 1)}
      ${pageButtons.join('')}
      ${navBtn('›', `goToHistoryPage(${historyCurrentPage + 1})`, historyCurrentPage === totalPages)}
      ${navBtn('»', `goToHistoryPage(${totalPages})`, historyCurrentPage === totalPages)}
    </div>
    <span>${startIdx}–${endIdx} of ${total} records</span>
  `;
}

// ── GO TO HISTORY PAGE ──
function goToHistoryPage(page) {
  const totalPages = Math.ceil(historyAllList.length / calcPageSize(52, 310));
  if (page < 1 || page > totalPages) return;
  historyCurrentPage = page;
  renderHistory();
}

// ── FORMAT DATE ──
function formatHistoryDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month:   'short',
    day:     'numeric',
    year:    'numeric',
    hour:    '2-digit',
    minute:  '2-digit'
  });
}

// ── ACTIVITY LOG ──
// page size is dynamic — see calcPageSize() in app.js
let activityCurrentPage  = 1;
let activityAllList      = [];

const ACTIVITY_LABELS = {
  LEAD_CREATED:       { label: 'Lead Created',        color: '#1B1F6B', bg: '#e8eaff' },
  DETAILS_UPDATED:    { label: 'Details Updated',     color: '#92400e', bg: '#fef3c7' },
  STATUS_UPDATED:     { label: 'Status Updated',      color: '#065f46', bg: '#d1fae5' },
  EMAIL_GENERATED:    { label: 'Email Generated',     color: '#1e40af', bg: '#dbeafe' },
  EMAIL_SENT:         { label: 'Email Sent',           color: '#166534', bg: '#dcfce7' },
  EMAIL_NOT_SENT:     { label: 'Email Not Sent',      color: '#991b1b', bg: '#fee2e2' },
  REMINDER_SENT:      { label: 'Reminder Sent',       color: '#5b21b6', bg: '#ede9fe' },
  MEETING_SCHEDULED:  { label: 'Meeting Scheduled',   color: '#0e7490', bg: '#cffafe' },
  MEETING_AUTO_DONE:  { label: 'Meeting Done',        color: '#166534', bg: '#dcfce7' },
  MEETING_CANCELLED:  { label: 'Meeting Cancelled',   color: '#991b1b', bg: '#fee2e2' },
  LEAD_CREATED_INQUIRY:{ label: 'Inquiry Received',   color: '#9a3412', bg: '#ffedd5' },
  PROMO_LINK_CLICKED:  { label: 'Link Clicked',        color: '#7c3aed', bg: '#ede9fe' },
  UNSUBSCRIBE_CLICKED: { label: 'Unsubscribe Clicked', color: '#dc2626', bg: '#fee2e2' },
  UNSUBSCRIBED:        { label: 'Unsubscribed',         color: '#7f1d1d', bg: '#fecaca' },
};

async function loadActivityLog() {
  try {
    const res = await fetch('/api/activity-logs');
    activityAllList    = await res.json();
    activityCurrentPage = 1;
    renderActivityLog();
  } catch (e) {
    showToast('Could not load activity log', 'error');
  }
}

function activityBadge(type) {
  const map = ACTIVITY_LABELS[type] || { label: type, color: '#374151', bg: '#f3f4f6' };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;
    font-size:11px;font-weight:700;background:${map.bg};color:${map.color};">
    ${map.label}
  </span>`;
}

function renderActivityLog() {
  const tbody = document.getElementById('activityLogTable');
  const total = activityAllList.length;

  if (!total) {
    tbody.innerHTML = emptyState('activity', 'No activity yet', 'System actions will be recorded here');
    const pg = document.getElementById('activityLogPagination');
    if (pg) pg.style.display = 'none';
    lucide.createIcons();
    return;
  }

  const pageSize   = calcPageSize(48, 310);
  const totalPages = Math.ceil(total / pageSize);
  if (activityCurrentPage > totalPages) activityCurrentPage = totalPages;

  const start = (activityCurrentPage - 1) * pageSize;
  const page  = activityAllList.slice(start, start + pageSize);

  tbody.innerHTML = page.map(r => `
    <tr>
      <td style="white-space:nowrap;font-size:12px;color:#6b7280;">${formatHistoryDate(r.created_at)}</td>
      <td>${activityBadge(r.activity_type)}</td>
      <td style="font-size:13px;color:#1B1F6B;font-weight:600;">${r.school_name || '—'}</td>
      <td style="font-size:13px;color:#374151;">${r.details || '—'}</td>
    </tr>
  `).join('');
  lucide.createIcons();

  renderActivityLogPagination(total, totalPages);
}

function renderActivityLogPagination(total, totalPages) {
  const pg = document.getElementById('activityLogPagination');
  if (!pg) return;
  if (totalPages <= 1) { pg.style.display = 'none'; return; }

  pg.style.display = 'flex';

  const MAX_VISIBLE = 5;
  let winStart = Math.max(1, activityCurrentPage - Math.floor(MAX_VISIBLE / 2));
  let winEnd   = winStart + MAX_VISIBLE - 1;
  if (winEnd > totalPages) { winEnd = totalPages; winStart = Math.max(1, winEnd - MAX_VISIBLE + 1); }

  const btnStyle = (active) =>
    `style="min-width:30px;height:30px;padding:0 8px;border-radius:6px;border:1px solid ${active ? '#1B1F6B' : '#e5e7eb'};background:${active ? '#1B1F6B' : '#fff'};color:${active ? '#fff' : '#374151'};font-size:12px;font-weight:600;cursor:${active ? 'default' : 'pointer'};"`;
  const navBtn = (label, onclick, disabled) =>
    `<button onclick="${onclick}" ${disabled ? 'disabled' : ''} style="min-width:30px;height:30px;padding:0 8px;border-radius:6px;border:1px solid #e5e7eb;background:#fff;color:${disabled ? '#d1d5db' : '#374151'};font-size:12px;font-weight:700;cursor:${disabled ? 'default' : 'pointer'};">${label}</button>`;

  const pageButtons = [];
  for (let i = winStart; i <= winEnd; i++) {
    pageButtons.push(`<button onclick="goToActivityPage(${i})" ${i === activityCurrentPage ? 'disabled' : ''} ${btnStyle(i === activityCurrentPage)}>${i}</button>`);
  }

  const pageSize = calcPageSize(48, 310);
  const startIdx = (activityCurrentPage - 1) * pageSize + 1;
  const endIdx   = Math.min(activityCurrentPage * pageSize, total);

  pg.innerHTML = `
    <div style="display:flex;gap:4px;align-items:center;">
      ${navBtn('«', 'goToActivityPage(1)', activityCurrentPage === 1)}
      ${navBtn('‹', `goToActivityPage(${activityCurrentPage - 1})`, activityCurrentPage === 1)}
      ${pageButtons.join('')}
      ${navBtn('›', `goToActivityPage(${activityCurrentPage + 1})`, activityCurrentPage === totalPages)}
      ${navBtn('»', `goToActivityPage(${totalPages})`, activityCurrentPage === totalPages)}
    </div>
    <span>${startIdx}–${endIdx} of ${total} records</span>
  `;
}

function goToActivityPage(page) {
  const totalPages = Math.ceil(activityAllList.length / calcPageSize(48, 310));
  if (page < 1 || page > totalPages) return;
  activityCurrentPage = page;
  renderActivityLog();
}