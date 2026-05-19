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

  const navMap = {
    dashboard: 'dashboard',
    schools:   'school leads',
    add:       'add school',
    import:    'import csv',
    drafts:    'email drafts',
    calendar:  'calendar',
    inquiries: 'inquiries',
    history:   'deletion history',
    settings:  'settings'
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
  if (name === 'history')    loadHistory();
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
    if (id === 'tab-schools')    loadSchools();
    if (id === 'tab-drafts')     loadDrafts();
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
function openChangePasswordModal() {
  document.getElementById('currentPassword').value  = '';
  document.getElementById('newPassword').value      = '';
  document.getElementById('confirmPassword').value  = '';
  document.getElementById('passwordChangeError').style.display = 'none';
  openModal('changePasswordModal');
}

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
    closeModal('changePasswordModal');

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