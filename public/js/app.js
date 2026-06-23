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

// ── DATE/TIME PREFERENCES ──
function getTimeFormat()  { return localStorage.getItem('timeFormat')  || '12'; }
function getDateFormat()  { return localStorage.getItem('dateFormat')  || 'short'; }

function applyFmtDate(dateStr) {
  if (!dateStr) return '—';
  const d   = new Date(dateStr);
  const fmt = getDateFormat();
  if (fmt === 'long')       return d.toLocaleDateString('en-PH', { month: 'long',  day: 'numeric', year: 'numeric' });
  if (fmt === 'mm-dd-yyyy') return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  if (fmt === 'dd-mm-yyyy') { const p = d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }); return p; }
  if (fmt === 'iso')        return d.toISOString().split('T')[0];
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── CLOCK ──
function updateClock() {
  const el = document.getElementById('clockDisplay');
  if (!el) return;
  const now  = new Date();
  const fmt  = getDateFormat();
  let datePart;
  if (fmt === 'mm-dd-yyyy') datePart = now.toLocaleDateString('en-US', { weekday:'short', month:'2-digit', day:'2-digit' });
  else if (fmt === 'dd-mm-yyyy') datePart = now.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'2-digit' });
  else if (fmt === 'iso')   datePart = now.toLocaleDateString('en-CA', { weekday:'short' }) + ' ' + now.toISOString().split('T')[0];
  else datePart = now.toLocaleDateString('en-PH', { weekday:'short', month:'short', day:'numeric' });

  const timePart = now.toLocaleTimeString('en-PH', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: getTimeFormat() === '12'
  });
  el.textContent = datePart + '  ' + timePart;
}
setInterval(updateClock, 1000);
updateClock();

// ── NAV MAP (global so updateModeLabels can modify it) ──
const navMap = {
  dashboard:     'dashboard',
  analytics:     'dashboard',
  schools:       'school leads',
  add:           'school leads',
  import:        'import csv',
  archived:      'archived',
  calendar:      'calendar',
  inquiries:     'inquiries',
  settings:      'settings',
  notifications: '__notifications__'
};

// ── TABS ──
let prevTab = 'dashboard';

function toggleNotifications() {
  const active = document.querySelector('.tab-section.active');
  const currentId = active ? active.id.replace('tab-', '') : 'dashboard';
  if (currentId === 'notifications') {
    showTab(prevTab || 'dashboard');
  } else {
    prevTab = currentId;
    showTab('notifications');
  }
}

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
  if (name === 'dashboard')     loadDashboard();
  if (name === 'schools')       loadSchools();
  if (name === 'archived')      { loadDrafts(); loadHistory(); }
  if (name === 'settings') {
    document.querySelector('aside nav:not(#settingsNav)').style.display = 'none';
    document.getElementById('settingsNav').style.display = '';
    showSettingsSection('company');
  }
  if (name === 'calendar')      loadCalendar();
  if (name === 'inquiries')     loadInquiries();
  if (name === 'import')        loadImportHistory();
  if (name === 'analytics')     loadAnalytics();
  if (name === 'notifications') loadNotificationsPage();
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
  return applyFmtDate(dateStr);
}

// ── FORMAT TIME SHORT (24h "14:00" → "2:00 PM") ──
function formatTimeShort(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
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
  loadNotifBadge();
  loadThemePref();

  // Auto refresh every 30 seconds
  setInterval(() => {
    const active = document.querySelector('.tab-section.active');
    if (!active) return;
    const id = active.id;
    if (id === 'tab-dashboard')  loadDashboard();
    if (id === 'tab-analytics')  loadAnalytics();
    if (id === 'tab-schools')    loadSchools(true);
    if (id === 'tab-archived')   { loadDrafts(); loadHistory(); }
    if (id === 'tab-settings')   loadActivityLog();
    if (id === 'tab-calendar')   loadCalendar();
    if (id === 'tab-inquiries')  loadInquiries();
    checkPendingInquiries();
    loadNotifBadge();
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

// ── SETTINGS SECTION SWITCH ──
const SETTINGS_SECTIONS = ['company', 'password', 'backup', 'activity', 'datetime', 'preferences'];
const SETTINGS_TITLES   = {
  company:     'Company Information',
  password:    'Change Password',
  backup:      'Database Backup',
  activity:    'Activity Log',
  datetime:    'Date & Time',
  preferences: 'Preferences',
};

function showSettingsSection(name) {
  SETTINGS_SECTIONS.forEach(s => {
    const el = document.getElementById('settings-' + s);
    if (el) el.style.display = s === name ? 'block' : 'none';
  });

  SETTINGS_SECTIONS.forEach(s => {
    const btn = document.getElementById('snav-' + s);
    if (btn) btn.classList.toggle('active', s === name);
  });

  const title = document.getElementById('settingsSectionTitle');
  if (title) title.textContent = SETTINGS_TITLES[name] || 'Settings';

  if (name === 'activity')     loadActivityLog();
  if (name === 'company')      loadCompanyInfo();
  if (name === 'datetime')     loadDateTimeSettings();
  if (name === 'preferences')  loadThemePref();
}

function loadThemePref() {
  const saved = localStorage.getItem('themePref') || 'light';
  selectThemePref(saved, true);
}

function selectThemePref(value, silent) {
  // Toggle dark class on body — CSS handles all visual changes
  document.body.classList.toggle('dark', value === 'dark');

  // Re-render charts so Chart.js picks up new dark/light colors
  if (typeof analyticsData !== 'undefined' && analyticsData) {
    if (typeof renderLeadsChart     === 'function') renderLeadsChart();
    if (typeof renderStatusChart    === 'function') renderStatusChart();
    if (typeof renderHeardFromChart === 'function') renderHeardFromChart();
  }

  // Highlight selected card in Preferences section (if visible)
  const lightCard = document.getElementById('pref-light');
  const darkCard  = document.getElementById('pref-dark');
  if (lightCard && darkCard) {
    const dark = document.body.classList.contains('dark');
    const activeBorder   = dark ? '#818cf8' : '#1B1F6B';
    const activeBg       = dark ? 'rgba(129,140,248,0.15)' : '#eef0fb';
    const inactiveBorder = dark ? 'rgba(255,255,255,0.12)' : '#e5e7eb';
    const inactiveBg     = dark ? '#252a42' : '#f9fafb';

    lightCard.style.borderColor = value === 'light' ? activeBorder : inactiveBorder;
    lightCard.style.background  = value === 'light' ? activeBg     : inactiveBg;
    darkCard.style.borderColor  = value === 'dark'  ? activeBorder : inactiveBorder;
    darkCard.style.background   = value === 'dark'  ? activeBg     : inactiveBg;
  }

  if (!silent) localStorage.setItem('themePref', value);
}

function backToMainNav() {
  document.getElementById('settingsNav').style.display  = 'none';
  document.querySelector('aside nav:not(#settingsNav)').style.display = '';
  showTab('dashboard');
}

// ── ARCHIVED SUB-TAB TOGGLE ──
function switchArchivedView(view) {
  document.getElementById('archived-drafts').style.display  = view === 'drafts'   ? 'block' : 'none';
  document.getElementById('archived-history').style.display = view === 'history'  ? 'block' : 'none';

  const activeStyle   = 'btn-navy text-sm';
  const inactiveStyle = 'btn-ghost text-sm';
  document.getElementById('archived-btn-drafts').className   = view === 'drafts'  ? activeStyle : inactiveStyle;
  document.getElementById('archived-btn-history').className  = view === 'history' ? activeStyle : inactiveStyle;
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

// ── DYNAMIC PAGE SIZE ──
// overhead = approximate px taken by header, title, search bar, table header, pagination, padding
function calcPageSize(rowHeight, overhead) {
  const available = Math.max(0, window.innerHeight - (overhead || 320));
  return Math.max(5, Math.floor(available / rowHeight));
}

// Re-render active paginated tab on resize
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    const active = document.querySelector('.tab-section.active');
    if (!active) return;
    const id = active.id;
    if (id === 'tab-schools')   renderSchools(schoolsFilteredList);
    if (id === 'tab-inquiries') renderInquiries(currentFilter);
    if (id === 'tab-archived')  { renderDraftsPage(); renderHistoryPage(); }
    if (id === 'tab-settings')  renderActivityPage();
    if (id === 'tab-import')    renderImportHistoryPage();
  }, 200);
});

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

// ── NOTIFICATIONS ──

async function loadNotifBadge() {
  try {
    const res   = await fetch('/api/notifications');
    const notifs = await res.json();
    const badge  = document.getElementById('notifBadge');
    if (!badge) return;
    const unread = notifs.filter(n => !n.is_read).length;
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = 'flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) { /* non-fatal */ }
}

async function loadNotificationsPage() {
  const container = document.getElementById('notificationsPageContent');
  if (!container) return;

  try {
    const res    = await fetch('/api/notifications');
    const notifs = await res.json();

    fetch('/api/notifications/mark-read', { method: 'POST' }).then(() => {
      document.getElementById('notifBadge').style.display = 'none';
    });

    if (!notifs.length) {
      container.innerHTML = `
        <div style="text-align:center; padding:80px 0;">
          <div style="width:56px;height:56px;background:#dcfce7;border-radius:50%;
            display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
            <i data-lucide="check-circle" style="width:26px;height:26px;color:#16a34a;"></i>
          </div>
          <div style="font-size:15px;font-weight:600;color:#374151;margin-bottom:4px;">All caught up!</div>
          <div style="font-size:13px;color:#9ca3af;">No notifications yet.</div>
        </div>`;
      lucide.createIcons();
      return;
    }

    const pinned  = notifs.filter(n => n.is_pinned);
    const unpinned = notifs.filter(n => !n.is_pinned);

    const now   = new Date();
    const today = now.toDateString();

    const groups = {};
    unpinned.forEach(n => {
      const d   = new Date(n.created_at);
      const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      let label;
      if (d.toDateString() === today)         label = 'Today';
      else if (diffDays <= 7)                 label = 'Previous 7 Days';
      else if (diffDays <= 30)                label = 'Previous 30 Days';
      else label = d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    });

    const sectionOrder = ['Today', 'Previous 7 Days', 'Previous 30 Days'];
    const monthGroups  = Object.keys(groups).filter(k => !sectionOrder.includes(k));

    const renderItem = (n) => {
      const iconMap = {
        lead:    'user-plus',
        inquiry: 'mail',
        meeting: 'calendar',
        email:   'send',
        import:  'file-up',
      };
      const colorMap = {
        lead:    { bg: '#eff6ff', color: '#1d4ed8' },
        inquiry: { bg: '#fef3c7', color: '#92400e' },
        meeting: { bg: '#f3e8ff', color: '#7c3aed' },
        email:   { bg: '#dcfce7', color: '#166534' },
        import:  { bg: '#f0fdf4', color: '#15803d' },
      };
      const icon  = iconMap[n.type]  || 'bell';
      const style = colorMap[n.type] || { bg: '#f3f4f6', color: '#374151' };
      const timeAgo = formatTimeAgo(n.created_at);
      const unreadDot = !n.is_read
        ? `<span style="width:7px;height:7px;background:#ef4444;border-radius:50%;flex-shrink:0;"></span>` : '';

      return `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:13px 0;
          border-bottom:1px solid #f3f4f6;">
          <div style="width:38px;height:38px;border-radius:10px;background:${style.bg};
            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i data-lucide="${icon}" style="width:16px;height:16px;color:${style.color};"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
              ${unreadDot}
              <div style="font-size:13px;font-weight:700;color:#111827;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.title}</div>
            </div>
            <div style="font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;
              text-overflow:ellipsis;">${n.body || ''}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:3px;">${timeAgo}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button onclick="toggleNotifPin(${n.id})" title="${n.is_pinned ? 'Unpin' : 'Pin'}"
              style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;
                color:${n.is_pinned ? '#1B1F6B' : '#d1d5db'};transition:color 0.15s;"
              onmouseover="this.style.color='#1B1F6B'"
              onmouseout="this.style.color='${n.is_pinned ? '#1B1F6B' : '#d1d5db'}'">
              <i data-lucide="pin" style="width:14px;height:14px;"></i>
            </button>
            <button onclick="deleteNotif(${n.id})" title="Dismiss"
              style="background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;
                color:#d1d5db;transition:color 0.15s;"
              onmouseover="this.style.color='#ef4444'"
              onmouseout="this.style.color='#d1d5db'">
              <i data-lucide="x" style="width:14px;height:14px;"></i>
            </button>
          </div>
        </div>`;
    };

    const renderSection = (label, items) => `
      <div style="margin-bottom:6px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:#9ca3af;
          text-transform:uppercase;padding:16px 0 6px;">${label}</div>
        ${items.map(renderItem).join('')}
      </div>`;

    let html = '';
    if (pinned.length) html += renderSection('Pinned', pinned);
    sectionOrder.forEach(k => { if (groups[k]) html += renderSection(k, groups[k]); });
    monthGroups.forEach(k  => { if (groups[k]) html += renderSection(k, groups[k]); });

    container.innerHTML = html;
    lucide.createIcons();

  } catch (e) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 0;color:#9ca3af;font-size:13px;">
        Could not load notifications.
      </div>`;
  }
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return m + ' min ago';
  const h = Math.floor(m / 60);
  if (h < 24)  return h + ' hr' + (h > 1 ? 's' : '') + ' ago';
  const d = Math.floor(h / 24);
  if (d < 7)   return d + ' day' + (d > 1 ? 's' : '') + ' ago';
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

async function toggleNotifPin(id) {
  try {
    await fetch(`/api/notifications/${id}/pin`, { method: 'POST' });
    loadNotificationsPage();
  } catch (e) { showToast('Failed to update pin', 'error'); }
}

async function deleteNotif(id) {
  try {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    loadNotificationsPage();
  } catch (e) { showToast('Failed to dismiss', 'error'); }
}

async function markAllNotifsRead() {
  try {
    await fetch('/api/notifications/mark-read', { method: 'POST' });
    loadNotificationsPage();
    showToast('All notifications marked as read', 'success');
  } catch (e) { showToast('Failed', 'error'); }
}

// ── COMPANY INFO ──
function loadDateTimeSettings() {
  const tf = getTimeFormat();
  const df = getDateFormat();
  const tfEl = document.getElementById('settingTimeFormat');
  const dfEl = document.getElementById('settingDateFormat');
  if (tfEl) tfEl.value = tf;
  if (dfEl) dfEl.value = df;
}

function saveDateTimeSettings() {
  const tf = document.getElementById('settingTimeFormat').value;
  const df = document.getElementById('settingDateFormat').value;
  localStorage.setItem('timeFormat', tf);
  localStorage.setItem('dateFormat', df);
  updateClock();
  showToast('Date & time settings saved!', 'success');
}

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