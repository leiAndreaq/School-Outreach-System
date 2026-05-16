// ── GLOBAL STATE ──
let currentSchoolId = null;
let statusTargetId = null;

// ── CLOCK ──
function updateClock() {
  const now = new Date();
  document.getElementById('clockDisplay').textContent =
    now.toLocaleDateString('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) + '  ' +
    now.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit'
    });
}
setInterval(updateClock, 1000);
updateClock();

// ── TABS ──
function showTab(name) {
  // Hide all tabs
  document.querySelectorAll('.tab-section').forEach(s => {
    s.classList.remove('active');
  });

  // Remove active from all nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
  });

  // Show the selected tab
  document.getElementById('tab-' + name).classList.add('active');

  // Set active nav item
  const navMap = {
    dashboard: 'dashboard',
    schools:   'school leads',
    add:       'add school',
    import:    'import csv',
    drafts:    'email drafts',
    calendar:  'calendar',
    inquiries: 'inquiries'
  };

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.textContent.trim().toLowerCase().includes(navMap[name])) {
      n.classList.add('active');
    }
  });

  // Load data for the tab
  if (name === 'dashboard') loadDashboard();
  if (name === 'schools')   loadSchools();
  if (name === 'drafts')    loadDrafts();
  if (name === 'calendar')  loadCalendar();
  if (name === 'inquiries')  loadInquiries();
}

// ── TOAST NOTIFICATIONS ──
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// ── MODALS ──
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── STATUS BADGE ──
function statusBadge(status) {
  const map = {
    'NEW_LEAD':                 'badge-new',
    'PROPOSAL_GENERATED':       'badge-generated',
    'FOR_APPROVAL':             'badge-generated',
    'EMAIL_SENT':               'badge-sent',
    'FOLLOW_UP_1':              'badge-generated',
    'INTERESTED':               'badge-interested',
    'PRESENTATION_SCHEDULED':   'badge-interested',
    'PRESENTED':                'badge-interested',
    'NEGOTIATION':              'badge-interested',
    'CLOSED_WON':               'badge-won',
    'CLOSED_LOST':              'badge-lost',
    'DO_NOT_CONTACT':           'badge-lost'
  };
  const cls = map[status] || 'badge-default';
  return `<span class="badge ${cls}">${status || 'NEW_LEAD'}</span>`;
}

// ── FORMAT DATE ──
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ── EMPTY STATE HTML ──
function emptyState(icon, title, sub = '') {
  return `
    <tr>
      <td colspan="99">
        <div class="empty-state">
          <div class="icon">${icon}</div>
          <div class="title">${title}</div>
          ${sub ? `<div class="sub">${sub}</div>` : ''}
        </div>
      </td>
    </tr>`;
}

// ── CHECK PENDING INQUIRIES (badge on sidebar) ──
async function checkPendingInquiries() {
  try {
    const res = await fetch('/api/inquiries/count/pending');
    const data = await res.json();
    const badge = document.getElementById('pendingBadge');
    if (data.count > 0) {
      badge.textContent = data.count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (e) {
    console.error('Could not check pending inquiries');
  }
}

// ── CHECK AI MODE ──
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const badge = document.getElementById('modeBadge');
    if (data.ai_mode === 'OPENAI_API') {
      badge.textContent = '✦ OPENAI MODE';
      badge.classList.remove('bg-red-900/40', 'text-red-300');
      badge.classList.add('bg-green-900/40', 'text-green-300');
    }
  } catch (e) {
    console.error('Health check failed:', e);
  }
  // Check pending inquiries count
  checkPendingInquiries();
}

// ── STATUS MODAL ──
function openStatusModal(id, currentStatus) {
  statusTargetId = id;
  document.getElementById('statusSelect').value = currentStatus || 'NEW_LEAD';
  openModal('statusModal');
}

async function confirmStatusUpdate() {
  const status = document.getElementById('statusSelect').value;
  try {
    await fetch('/api/schools/' + statusTargetId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    showToast('Status updated!', 'success');
    closeModal('statusModal');
    loadSchools();
    loadDashboard();
  } catch (e) {
    showToast('Failed to update status', 'error');
  }
}

// ── INIT ──
checkHealth();

// Wait for page to fully load before fetching data
window.addEventListener('load', () => {
  loadDashboard();

  // Auto refresh every 10 seconds
  setInterval(() => {
    // Refresh whichever tab is currently active
    const active = document.querySelector('.tab-section.active');
    if (!active) return;

    const id = active.id;
    if (id === 'tab-dashboard')  loadDashboard();
    if (id === 'tab-schools')    loadSchools();
    if (id === 'tab-drafts')     loadDrafts();
    if (id === 'tab-calendar')   loadCalendar();
    if (id === 'tab-inquiries')  loadInquiries();

    // Always check pending badge
    checkPendingInquiries();
  }, 10000);
});