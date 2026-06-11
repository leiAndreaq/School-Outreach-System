// ── GLOBAL STATE ──
let currentSchoolId = null;
let statusTargetId = null;

// ── GENERIC CONFIRM MODAL ──
let _confirmResolve = null;

function showConfirmModal(title, message, confirmLabel = 'Confirm', confirmClass = 'btn-navy') {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirmModalTitle').innerHTML = title;
    document.getElementById('confirmModalMessage').innerHTML = message;
    const btn = document.getElementById('confirmModalBtn');
    btn.textContent = confirmLabel;
    btn.className = confirmClass + ' text-sm';
    openModal('confirmModal');
    lucide.createIcons();
  });
}

function resolveConfirm(result) {
  closeModal('confirmModal');
  if (_confirmResolve) {
    _confirmResolve(result);
    _confirmResolve = null;
  }
}

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

// ── NAV MAP (global so updateModeLabels can modify it) ──
const navMap = {
  dashboard: 'dashboard',
  analytics: 'dashboard',
  schools:   'school leads',
  add:       'school leads',
  import:    'import csv',
  archived:  'archived',
  calendar:  'calendar',
  inquiries: 'inquiries',
  settings:  'settings'
};

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
  if (name === 'settings')   loadCompanyInfo();
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

// ── ICON HELPER (for dynamic HTML) ──
function licon(name, size = 14) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;flex-shrink:0;"></i>`;
}

// ── EMPTY STATE HTML ──
function emptyState(iconName, title, sub = '') {
  return `
    <tr>
      <td colspan="99">
        <div class="empty-state">
          <div class="icon"><i data-lucide="${iconName}" style="width:36px;height:36px;color:#9ca3af;stroke-width:1.5;"></i></div>
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
    const res = await fetch('/api/schools/' + statusTargetId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) { showToast('Failed to update status', 'error'); return; }
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
  loadNotifications();

  // Auto refresh every 30 seconds
  setInterval(() => {
    const active = document.querySelector('.tab-section.active');
    if (!active) return;
    const id = active.id;
    if (id === 'tab-dashboard')  loadDashboard();
    if (id === 'tab-analytics')  loadAnalytics();
    if (id === 'tab-schools')    loadSchools(true);
    if (id === 'tab-archived')   { loadDrafts(); loadHistory(); }
    if (id === 'tab-calendar')   loadCalendar();
    if (id === 'tab-inquiries')  loadInquiries();
    checkPendingInquiries();
    loadNotifications();
  }, 30000);

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

  // Clear settings password error when user starts typing
  ['currentPassword','newPassword','confirmPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const errEl = document.getElementById('passwordChangeError');
      if (errEl) errEl.style.display = 'none';
    });
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
  const ok = await showConfirmModal(
    '<i data-lucide="log-out" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;"></i> Logout',
    'Are you sure you want to logout?',
    'Logout',
    'btn-navy'
  );
  if (!ok) return;

  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (e) {
    console.error('Logout error');
  }
  window.location.href = '/login.html';
}

// ── SEARCH CLEAR BUTTON HELPERS ──
function toggleClearBtn(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input || !btn) return;
  btn.style.display = input.value ? 'inline-flex' : 'none';
  lucide.createIcons();
}

function clearSearchInput(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (input) input.value = '';
  if (btn)   btn.style.display = 'none';
}

// ── NOTIFICATIONS: PAST UNUPDATED MEETINGS ──
let _notifPanelOpen = false;

async function loadNotifications() {
  try {
    const res      = await fetch('/api/meetings/past-unupdated');
    const meetings = await res.json();
    const badge    = document.getElementById('notifBadge');
    if (!badge) return;

    if (meetings.length > 0) {
      badge.textContent    = meetings.length > 9 ? '9+' : meetings.length;
      badge.style.display  = 'flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
    } else {
      badge.style.display = 'none';
    }

    renderNotifPanel(meetings);
  } catch (e) {
    // non-fatal
  }
}

function renderNotifPanel(meetings) {
  const content = document.getElementById('notifPanelContent');
  if (!content) return;

  if (!meetings.length) {
    content.innerHTML = `
      <div style="padding:24px 20px; text-align:center;">
        <div style="width:44px;height:44px;background:#dcfce7;border-radius:50%;
          display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">
          <i data-lucide="check-circle" style="width:22px;height:22px;color:#16a34a;"></i>
        </div>
        <div style="font-size:14px;font-weight:600;color:#374151;margin-bottom:4px;">All caught up!</div>
        <div style="font-size:12px;color:#9ca3af;">No past meetings need updating.</div>
      </div>`;
    lucide.createIcons();
    return;
  }

  const rows = meetings.map(m => `
    <div style="padding:11px 16px; border-bottom:1px solid #f3f4f6;
      display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div style="min-width:0;">
        <div style="font-size:13px; font-weight:600; color:#1B1F6B;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${m.school_name}
        </div>
        <div style="font-size:11px; color:#9ca3af; margin-top:2px;">
          ${m.meeting_date} &nbsp;·&nbsp; ${formatTime(m.meeting_time)}
        </div>
      </div>
      <span style="flex-shrink:0; font-size:11px; background:#fef3c7; color:#92400e;
        padding:3px 9px; border-radius:20px; font-weight:600; white-space:nowrap;">
        ${m.status}
      </span>
    </div>
  `).join('');

  content.innerHTML = `
    <div style="padding:14px 16px; border-bottom:1px solid #f0f0f8;
      display:flex; align-items:center; gap:8px;">
      <div style="width:30px;height:30px;background:#fee2e2;border-radius:8px;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i data-lucide="alert-circle" style="width:15px;height:15px;color:#ef4444;"></i>
      </div>
      <div>
        <div style="font-size:13px; font-weight:700; color:#111827;">
          ${meetings.length} past meeting${meetings.length > 1 ? 's' : ''} need updating
        </div>
        <div style="font-size:11px; color:#9ca3af;">These were auto-marked as Done overnight</div>
      </div>
    </div>
    <div style="max-height:260px; overflow-y:auto;">
      ${rows}
    </div>
    <div style="padding:12px 16px; border-top:1px solid #f0f0f8;">
      <button onclick="markAllPastDone()"
        style="width:100%; padding:9px 0; background:#1B1F6B; color:#fff; border:none;
          border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:6px;">
        <i data-lucide="check-circle" style="width:14px;height:14px;"></i>
        Mark All as Done
      </button>
    </div>`;
  lucide.createIcons();
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  _notifPanelOpen = !_notifPanelOpen;
  panel.style.display = _notifPanelOpen ? 'block' : 'none';
}

async function markAllPastDone() {
  try {
    const res  = await fetch('/api/meetings/mark-past-done', { method: 'POST' });
    const data = await res.json();
    if (data.error) { showToast('Error: ' + data.error, 'error'); return; }
    showToast(data.updated + ' meeting(s) marked as Done', 'success');
    _notifPanelOpen = false;
    document.getElementById('notifPanel').style.display = 'none';
    loadNotifications();
    if (typeof loadCalendar === 'function') loadCalendar();
    if (typeof loadDashboard === 'function') loadDashboard();
  } catch (e) {
    showToast('Failed to update meetings', 'error');
  }
}

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
  const bell  = document.getElementById('notifBellBtn');
  const panel = document.getElementById('notifPanel');
  if (!bell || !panel || !_notifPanelOpen) return;
  if (!bell.contains(e.target) && !panel.contains(e.target)) {
    panel.style.display = 'none';
    _notifPanelOpen = false;
  }
});

// ── COMPANY INFO ──
async function loadCompanyInfo() {
  try {
    const res  = await fetch('/api/settings/company');
    const data = await res.json();
    document.getElementById('settingCompanyName').value    = data.company_name    || '';
    document.getElementById('settingCompanyEmail').value   = data.company_email   || '';
    document.getElementById('settingCompanyPhone').value   = data.company_phone   || '';
    document.getElementById('settingCompanyAddress').value = data.company_address || '';
  } catch (e) {
    // fields stay empty — non-fatal
  }
}

async function saveCompanyInfo() {
  const errorEl = document.getElementById('companyInfoError');
  errorEl.style.display = 'none';

  const payload = {
    company_name:    document.getElementById('settingCompanyName').value.trim(),
    company_email:   document.getElementById('settingCompanyEmail').value.trim(),
    company_phone:   document.getElementById('settingCompanyPhone').value.trim(),
    company_address: document.getElementById('settingCompanyAddress').value.trim(),
  };

  if (!payload.company_name) {
    errorEl.textContent   = 'Company name is required.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res  = await fetch('/api/settings/company', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.error) {
      errorEl.textContent   = data.error;
      errorEl.style.display = 'block';
      return;
    }

    showToast('Company info saved!', 'success');
  } catch (e) {
    showToast('Failed to save company info', 'error');
  }
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

    showToast('Password changed successfully!', 'success');
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
    btn.disabled   = true;
    btn.innerHTML  = `${licon('loader', 16)} Backing up...`;
  }

  try {
    const res  = await fetch('/api/backup', { method: 'POST' });
    const data = await res.json();

    if (data.error) {
      showToast('Backup failed: ' + data.error, 'error');
      return;
    }

    showToast('Backup created successfully!', 'success');

  } catch (e) {
    showToast('Backup failed', 'error');
  } finally {
    if (btn) {
      setTimeout(() => {
        btn.disabled  = false;
        btn.innerHTML = `${licon('database-backup', 16)} Backup Data`;
        lucide.createIcons();
      }, 5000);
    }
  }
}