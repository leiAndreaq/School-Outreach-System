// ── HISTORY PAGINATION STATE ──
const HISTORY_PAGE_SIZE  = 5;
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

  const totalPages = Math.ceil(total / HISTORY_PAGE_SIZE);
  if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;

  const start = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE;
  const page  = historyAllList.slice(start, start + HISTORY_PAGE_SIZE);

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

  const startIdx = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE + 1;
  const endIdx   = Math.min(historyCurrentPage * HISTORY_PAGE_SIZE, total);

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
  const totalPages = Math.ceil(historyAllList.length / HISTORY_PAGE_SIZE);
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