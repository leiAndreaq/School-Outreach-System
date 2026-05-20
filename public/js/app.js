// ── GLOBAL STATE ──
let currentSchoolId = null;
let statusTargetId = null;

// ── CLOCK ──
function updateClock() {
  const el = document.getElementById('clockDisplay');
  if (!el) return; // element may not exist yet if script runs before DOM is fully parsed
  const now = new Date();
  el.textContent =
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
  // Close dashboard dropdown when switching away from dashboard tabs
  if (name !== 'dashboard' && name !== 'analytics') {
    const dd = document.getElementById('dashDropdown');
    const ch = document.getElementById('dashChevron');
    if (dd) dd.classList.remove('open');
    if (ch) ch.classList.add('rotated');
  }

  // Hide all tabs
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));

  // Remove active from all nav items and sub-items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(n => n.classList.remove('active'));

  // Show the selected tab
  document.getElementById('tab-' + name).classList.add('active');

  const navMap = {
    dashboard: 'dashboard',
    analytics: 'dashboard',
    schools:   'school leads',
    add:       'add school',
    import:    'import csv',
    archived:  'archived',
    calendar:  'calendar',
    inquiries: 'inquiries',
    settings:  'settings'
  };

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.textContent.trim().toLowerCase().includes(navMap[name])) {
      n.classList.add('active');
    }
  });

  // Mark the correct sub-item active
  if (name === 'dashboard') {
    const el = document.getElementById('subnav-overview');
    if (el) el.classList.add('active');
  } else if (name === 'analytics') {
    const el = document.getElementById('subnav-analytics');
    if (el) el.classList.add('active');
  }

  // Load data for the tab
  if (name === 'dashboard')  loadDashboard();
  if (name === 'schools')    loadSchools();
  if (name === 'archived')   { loadDrafts(); loadHistory(); }
  if (name === 'calendar')   loadCalendar();
  if (name === 'inquiries')  loadInquiries();
  if (name === 'import')     loadImportHistory();
  if (name === 'analytics')  loadAnalytics();
}

// ── DASHBOARD DROPDOWN ──
function toggleDashboardDropdown() {
  const dd = document.getElementById('dashDropdown');
  const ch = document.getElementById('dashChevron');
  const isOpen = dd.classList.contains('open');

  if (isOpen) {
    dd.classList.remove('open');
    ch.classList.add('rotated');
  } else {
    dd.classList.add('open');
    ch.classList.remove('rotated');
    // Navigate to overview only if currently on a non-dashboard tab
    const activeTab = document.querySelector('.tab-section.active');
    if (!activeTab || (activeTab.id !== 'tab-dashboard' && activeTab.id !== 'tab-analytics')) {
      showTab('dashboard');
    }
  }
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
    if (data.ai_mode === 'OPENAI_API') {
      const badge = document.getElementById('modeBadge');
      if (badge) {
        badge.textContent = '✦ OPENAI MODE';
        badge.classList.remove('bg-red-900/40', 'text-red-300');
        badge.classList.add('bg-green-900/40', 'text-green-300');
      }
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

window.addEventListener('load', async () => {

  // ── CHECK SESSION FIRST ──
  try {
    const res  = await fetch('/api/session');
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/login.html';
      return;
    }
  } catch (e) {
    window.location.href = '/login.html';
    return;
  }

  loadDashboard();

  // Auto refresh every 10 seconds
  setInterval(() => {
    const active = document.querySelector('.tab-section.active');
    if (!active) return;
    const id = active.id;
    if (id === 'tab-dashboard')  loadDashboard();
    if (id === 'tab-analytics')  loadAnalytics();
    if (id === 'tab-schools')    loadSchools();
    if (id === 'tab-archived')   { loadDrafts(); loadHistory(); }
    if (id === 'tab-calendar')   loadCalendar();
    if (id === 'tab-inquiries')  loadInquiries();
    checkPendingInquiries();
  }, 10000);

  // ── SESSION EXPIRY CHECK ──
  async function checkSession() {
    try {
      const res  = await fetch('/api/session');
      const data = await res.json();
      if (!data.authenticated) {
        showToast('Session expired. Redirecting to login...', '');
        setTimeout(() => { window.location.href = '/login.html'; }, 2000);
      }
    } catch (e) {
      window.location.href = '/login.html';
    }
  }

  // Check every minute while tab is active
  setInterval(checkSession, 60 * 1000);

  // Re-validate immediately whenever the user returns to this tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkSession();
  });

});

// ── ARCHIVED SUB-TAB TOGGLE ──
function switchArchivedView(view) {
  const showDrafts  = view === 'drafts';
  document.getElementById('archived-drafts').style.display  = showDrafts ? 'block' : 'none';
  document.getElementById('archived-history').style.display = showDrafts ? 'none'  : 'block';

  const activeStyle   = 'btn-navy text-sm';
  const inactiveStyle = 'btn-ghost text-sm';
  document.getElementById('archived-btn-drafts').className  = showDrafts ? activeStyle : inactiveStyle;
  document.getElementById('archived-btn-history').className = showDrafts ? inactiveStyle : activeStyle;
}

// ── LOGOUT ──
async function handleLogout() {
  const confirmed = confirm('Are you sure you want to logout?');
  if (!confirmed) return;

  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (e) {
    console.error('Logout error');
  }
  window.location.href = '/login.html';
}

// ── CHANGE PASSWORD ──
async function submitChangePassword() {
  const current  = document.getElementById('currentPassword').value.trim();
  const newPass  = document.getElementById('newPassword').value.trim();
  const confirm  = document.getElementById('confirmPassword').value.trim();
  const errorEl  = document.getElementById('passwordChangeError');

  errorEl.style.display = 'none';

  if (!current || !newPass || !confirm) {
    errorEl.textContent   = 'Please fill in all fields.';
    errorEl.style.display = 'block';
    return;
  }

  if (newPass.length < 8) {
    errorEl.textContent   = 'New password must be at least 8 characters.';
    errorEl.style.display = 'block';
    return;
  }

  if (newPass !== confirm) {
    errorEl.textContent   = 'New passwords do not match.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res  = await fetch('/api/change-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        current_password: current,
        new_password:     newPass
      })
    });
    const data = await res.json();

    if (data.error) {
      errorEl.textContent   = data.error;
      errorEl.style.display = 'block';
      return;
    }

    showToast('✅ Password changed successfully!', 'success');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';

  } catch (e) {
    errorEl.textContent   = 'Something went wrong. Please try again.';
    errorEl.style.display = 'block';
  }
}

// ── MANUAL BACKUP ──
async function triggerBackup() {
  const btn = document.querySelector('[onclick="triggerBackup()"]');

  // Disable button to prevent spam clicking
  if (btn) {
    btn.disabled        = true;
    btn.textContent     = '💾 Backing up...';
  }

  try {
    const res  = await fetch('/api/backup', { method: 'POST' });
    const data = await res.json();

    if (data.error) {
      showToast('Backup failed: ' + data.error, 'error');
      return;
    }

    showToast('💾 Backup created successfully!', 'success');

  } catch (e) {
    showToast('Backup failed', 'error');
  } finally {
    // Re-enable after 5 seconds
    if (btn) {
      setTimeout(() => {
        btn.disabled    = false;
        btn.textContent = '💾 Backup';
      }, 5000);
    }
  }
}