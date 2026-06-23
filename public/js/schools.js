// ── GLOBAL SCHOOLS DATA ──
let allSchools = [];
let selectedSchoolIds = new Set();
let currentSchoolStatus = 'NEW_LEAD';
let currentLeadType = 'OFFICIAL';

// ── SWITCH BETWEEN OFFICIAL / PROMOTIONAL ──
function switchSchoolsView(type) {
  currentLeadType = type;

  const activeStyle   = 'btn-navy text-sm';
  const inactiveStyle = 'btn-ghost text-sm';
  document.getElementById('schools-btn-official').className    = type === 'OFFICIAL'    ? activeStyle : inactiveStyle;
  document.getElementById('schools-btn-promotional').className = type === 'PROMOTIONAL' ? activeStyle : inactiveStyle;

  const title = document.getElementById('schools-tab-title');
  if (title) title.textContent = type === 'OFFICIAL' ? 'Official Leads' : 'Promotional Leads';

  const addBtn = document.getElementById('btn-add-lead');
  if (addBtn) addBtn.style.display = type === 'OFFICIAL' ? '' : 'none';

  const isPromo = type === 'PROMOTIONAL';
  const pauseBtn   = document.getElementById('btn-pause-campaign');
  const previewBtn = document.getElementById('btn-preview-template');
  const statsBar   = document.getElementById('promoCampaignStats');
  if (pauseBtn)   pauseBtn.style.display   = isPromo ? '' : 'none';
  if (previewBtn) previewBtn.style.display = isPromo ? '' : 'none';
  if (statsBar)   statsBar.style.display   = isPromo ? '' : 'none';

  if (isPromo) {
    loadPromoCampaignStatus();
    loadPromoStats();
  }

  loadSchools();
}

// ── PROMO: LOAD CAMPAIGN STATUS (pause/resume button label) ──
async function loadPromoCampaignStatus() {
  try {
    const data = await fetch('/api/promo-campaign/status').then(r => r.json());
    const label = document.getElementById('pause-campaign-label');
    const icon  = document.querySelector('#btn-pause-campaign i[data-lucide]');
    if (label) label.textContent = data.paused ? 'Resume Campaign' : 'Pause Campaign';
    if (icon)  icon.setAttribute('data-lucide', data.paused ? 'play-circle' : 'pause-circle');
    lucide.createIcons();
  } catch (_) {}
}

// ── PROMO: TOGGLE PAUSE/RESUME ──
async function togglePromoCampaign() {
  try {
    const data = await fetch('/api/promo-campaign/toggle', { method: 'POST' }).then(r => r.json());
    const label = document.getElementById('pause-campaign-label');
    const icon  = document.querySelector('#btn-pause-campaign i[data-lucide]');
    if (label) label.textContent = data.paused ? 'Resume Campaign' : 'Pause Campaign';
    if (icon)  icon.setAttribute('data-lucide', data.paused ? 'play-circle' : 'pause-circle');
    lucide.createIcons();
    showToast(data.paused ? 'Campaign paused — no emails will send on Monday.' : 'Campaign resumed.', data.paused ? 'error' : 'success');
  } catch (_) {
    showToast('Could not toggle campaign status', 'error');
  }
}

// ── PROMO: LOAD STATS BAR ──
async function loadPromoStats() {
  try {
    const s = await fetch('/api/promo-stats').then(r => r.json());
    document.getElementById('stat-total').textContent       = s.total       ?? '—';
    document.getElementById('stat-sent').textContent        = s.emails_sent ?? '—';
    document.getElementById('stat-opens').textContent       = s.opens       ?? '—';
    document.getElementById('stat-clicks').textContent      = s.clicks      ?? '—';
    document.getElementById('stat-conversions').textContent = s.conversions  ?? '—';
    document.getElementById('stat-unsub').textContent       = s.unsubscribed ?? '—';
  } catch (_) {}
}

// ── PROMO: TEMPLATE PREVIEW ──
async function openPromoPreview() {
  const phtNow     = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const weekNumber = Math.ceil((phtNow - new Date(phtNow.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  const tNum       = ((weekNumber - 1) % 4) + 1;
  document.getElementById('promoPreviewTemplateNum').textContent = `(Template ${tNum} — current week)`;
  loadPromoPreview(tNum);
  openModal('promoPreviewModal');
}

function loadPromoPreview(templateNum) {
  const frame = document.getElementById('promoPreviewFrame');
  if (frame) frame.src = `/api/promo-preview?template=${templateNum}`;
  document.getElementById('promoPreviewTemplateNum').textContent = `(Template ${templateNum})`;
}

// ── PROMO: RESUBSCRIBE SCHOOL ──
async function resubscribeSchool(schoolId) {
  try {
    await fetch(`/api/schools/${schoolId}/resubscribe`, { method: 'POST' });
    showToast('School re-added to promotional campaign.', 'success');
    closeModal('schoolModal');
    loadSchools();
  } catch (_) {
    showToast('Could not resubscribe school', 'error');
  }
}

// ── PROMO: RETRY FAILED EMAIL ──
async function retryPromoEmail(schoolId) {
  showToast('Sending retry...', 'success');
  try {
    const res  = await fetch(`/api/schools/${schoolId}/retry-promo`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Retry failed', 'error'); return; }
    showToast('Promotional email resent successfully.', 'success');
    closeModal('schoolModal');
    loadSchools();
  } catch (_) {
    showToast('Could not send retry', 'error');
  }
}

// ── PAGINATION STATE ──
// page size is dynamic — see calcPageSize() in app.js
let schoolsCurrentPage   = 1;
let schoolsFilteredList  = [];

// ── LOAD DASHBOARD ──
async function loadDashboard() {
  try {
    const res = await fetch('/api/schools?mode=' + (window.currentMode || 'school') + '&lead_type=OFFICIAL');
    const schools = await res.json();
    allSchools = schools;

    // Update stat numbers
    document.getElementById('stat-total').textContent = schools.length;
    document.getElementById('stat-new').textContent =
      schools.filter(s => !s.status || s.status === 'NEW_LEAD').length;
    document.getElementById('stat-sent').textContent =
      schools.filter(s => s.status === 'EMAIL_SENT').length;
    document.getElementById('stat-interested').textContent =
      schools.filter(s => ['INTERESTED','PRESENTATION_SCHEDULED','PRESENTED','NEGOTIATION'].includes(s.status)).length;

    // Show 5 most recently added schools
    const recent = schools
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    const tbody = document.getElementById('dashboardTable');

    if (!recent.length) {
      tbody.innerHTML = emptyState(
        'school',
        'No leads yet',
        'Add your first school lead to get started'
      );
      lucide.createIcons();
      return;
    }

    tbody.innerHTML = recent.map(s => `
      <tr>
        <td>${s.school_name}</td>
        <td>${s.city_province || '—'}</td>
        <td>${s.school_type || '—'}</td>
        <td>${statusBadge(s.status)}</td>
        <td>${fmtDate(s.created_at)}</td>
        <td>
          <button
            onclick="viewSchool(${s.id})"
            class="btn-ghost text-xs py-1 px-3">
            View
          </button>
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
    loadTodaysMeetings();

  } catch (e) {
    showToast('Could not load dashboard', 'error');
  }
}

// ── LOAD ALL SCHOOLS ──
async function loadSchools(preserveSelection = false) {
  try {
    if (!preserveSelection) {
      schoolsCurrentPage = 1;
      selectedSchoolIds.clear();
    }
    const mode = window.currentMode || 'school';
    const res  = await fetch(`/api/schools?mode=${mode}&lead_type=${currentLeadType}`);
    allSchools  = await res.json();
    renderSchools(allSchools);
  } catch (e) {
    showToast('Could not load schools', 'error');
  }
}

// ── EXPORT SCHOOLS AS CSV ──
function exportSchoolsCSV() {
  if (!allSchools.length) {
    showToast('No schools to export', 'error');
    return;
  }

  const escape = (val) => {
    if (val == null) return '';
    const s = String(val);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const headers = [
    'School Name', 'Contact Person', 'Email', 'Phone',
    'Website', 'Facebook Page', 'Address', 'City/Province',
    'Region', 'School Type', 'Level Offered', 'Est. Students',
    'Status', 'Notes', 'Date Added'
  ];

  const rows = allSchools.map(s => [
    escape(s.school_name),
    escape(s.contact_person),
    escape(s.email),
    escape(s.phone),
    escape(s.website),
    escape(s.facebook_page),
    escape(s.address),
    escape(s.city_province),
    escape(s.region),
    escape(s.school_type),
    escape(s.level_offered),
    escape(s.estimated_students),
    escape(s.status),
    escape(s.notes),
    escape(s.created_at ? s.created_at.split('T')[0] : '')
  ].join(','));

  const csv     = [headers.join(','), ...rows].join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const today   = new Date().toISOString().split('T')[0];
  const link    = document.createElement('a');
  link.href     = url;
  link.download = `school-leads-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showToast(`Exported ${allSchools.length} school(s)`, 'success');
}

// ── RENDER SCHOOLS TABLE ──
function renderSchools(schools) {
  schoolsFilteredList = schools;

  const tbody = document.getElementById('schoolsTable');
  const pagEl = document.getElementById('schoolsPagination');

  if (!schools.length) {
    tbody.innerHTML = emptyState(
      'clipboard-list',
      'No schools found',
      'Try a different search or add a new school'
    );
    lucide.createIcons();
    pagEl.style.display = 'none';
    return;
  }

  const pageSize   = calcPageSize(56, 370);
  const totalPages = Math.ceil(schools.length / pageSize);
  if (schoolsCurrentPage > totalPages) schoolsCurrentPage = totalPages;

  const start      = (schoolsCurrentPage - 1) * pageSize;
  const pageSlice  = schools.slice(start, start + pageSize);

  tbody.innerHTML = pageSlice.map(s => `
    <tr>
      <td style="width:40px; padding:8px 0 8px 16px;">
        <input type="checkbox" class="school-checkbox" value="${s.id}"
          onchange="toggleSchoolSelect(${s.id}, this)"
          ${selectedSchoolIds.has(s.id) ? 'checked' : ''}
          style="width:16px; height:16px; cursor:pointer; accent-color:#1B1F6B;">
      </td>
      <td>${s.school_name}</td>
      <td>${s.contact_person || '—'}</td>
      <td>${s.city_province || '—'}</td>
      <td>${s.level_offered || '—'}</td>
      <td>${statusBadge(s.status)}</td>
      <td style="font-size:12px;color:#6b7280;white-space:nowrap;">${fmtDate(s.created_at)}</td>
      <td>
        <button
          onclick="viewSchool(${s.id})"
          class="btn-ghost text-xs py-1 px-3" style="display:inline-flex;align-items:center;gap:4px;">
          ${licon('eye')} View
        </button>
      </td>
    </tr>
  `).join('');

  renderSchoolsPagination(schools.length, totalPages);
  updateSelectAllState();
  lucide.createIcons();
}

// ── PAGINATION RENDER ──
function renderSchoolsPagination(total, totalPages) {
  const el = document.getElementById('schoolsPagination');
  if (totalPages <= 1) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'flex';

  const pageSize = calcPageSize(56, 370);
  const start = (schoolsCurrentPage - 1) * pageSize + 1;
  const end   = Math.min(schoolsCurrentPage * pageSize, total);

  const btnBase = 'width:32px;height:32px;border-radius:6px;font-size:13px;cursor:pointer;transition:all 0.15s;';

  const MAX_VISIBLE = 5;
  let winStart = Math.max(1, schoolsCurrentPage - Math.floor(MAX_VISIBLE / 2));
  let winEnd   = winStart + MAX_VISIBLE - 1;
  if (winEnd > totalPages) {
    winEnd   = totalPages;
    winStart = Math.max(1, winEnd - MAX_VISIBLE + 1);
  }

  let pageButtons = '';
  for (let i = winStart; i <= winEnd; i++) {
    const active = i === schoolsCurrentPage;
    pageButtons += `<button onclick="goToSchoolsPage(${i})" style="${btnBase}
      font-weight:${active ? '700' : '500'};
      background:${active ? '#201658' : 'transparent'};
      color:${active ? '#fff' : '#374151'};
      border:1px solid ${active ? '#201658' : '#d1d5db'};">${i}</button>`;
  }

  const onFirst = schoolsCurrentPage === 1;
  const onLast  = schoolsCurrentPage === totalPages;

  const navBtn = (onclick, disabled, label) =>
    `<button onclick="${onclick}" ${disabled ? 'disabled' : ''}
      style="${btnBase} background:transparent; border:1px solid #d1d5db;
        color:${disabled ? '#9ca3af' : '#374151'};
        cursor:${disabled ? 'not-allowed' : 'pointer'}; font-size:11px;">${label}</button>`;

  el.innerHTML = `
    <div style="display:flex;gap:4px;align-items:center;">
      ${navBtn(`goToSchoolsPage(1)`,                    onFirst, '&laquo;')}
      ${navBtn(`goToSchoolsPage(${schoolsCurrentPage - 1})`, onFirst, '&lsaquo;')}
      ${pageButtons}
      ${navBtn(`goToSchoolsPage(${schoolsCurrentPage + 1})`, onLast,  '&rsaquo;')}
      ${navBtn(`goToSchoolsPage(${totalPages})`,         onLast,  '&raquo;')}
    </div>
    <span>${start}–${end} of ${total} school${total !== 1 ? 's' : ''}</span>
  `;
}

// ── GO TO PAGE ──
function goToSchoolsPage(page) {
  const totalPages = Math.ceil(schoolsFilteredList.length / calcPageSize(56, 370));
  if (page < 1 || page > totalPages) return;
  schoolsCurrentPage = page;
  renderSchools(schoolsFilteredList);
}

// ── MULTI-SELECT ──
function toggleSchoolSelect(id, cb) {
  if (cb.checked) selectedSchoolIds.add(id);
  else selectedSchoolIds.delete(id);
  updateSelectAllState();
  updateBulkActionBar();
}

function toggleSelectAll(masterCb) {
  if (masterCb.checked) {
    schoolsFilteredList.forEach(s => selectedSchoolIds.add(s.id));
  } else {
    schoolsFilteredList.forEach(s => selectedSchoolIds.delete(s.id));
  }
  // Reflect on currently visible checkboxes
  document.querySelectorAll('.school-checkbox').forEach(cb => {
    cb.checked = masterCb.checked;
  });
  updateBulkActionBar();
}

function updateSelectAllState() {
  const master = document.getElementById('selectAllCheckbox');
  if (!master) return;
  const total   = schoolsFilteredList.length;
  const selected = schoolsFilteredList.filter(s => selectedSchoolIds.has(s.id)).length;
  if (selected === 0) {
    master.checked = false;
    master.indeterminate = false;
  } else if (selected === total) {
    master.checked = true;
    master.indeterminate = false;
  } else {
    master.checked = false;
    master.indeterminate = true;
  }
  updateBulkActionBar();
}

function updateBulkActionBar() {
  const bar   = document.getElementById('bulkActionBar');
  const count = document.getElementById('selectedCount');
  if (!bar) return;
  if (selectedSchoolIds.size > 0) {
    bar.style.display = 'flex';
    count.textContent = `${selectedSchoolIds.size} school${selectedSchoolIds.size > 1 ? 's' : ''} selected`;
    const allCountEl = document.getElementById('selectAllCount');
    if (allCountEl) allCountEl.textContent = allSchools.length;
  } else {
    bar.style.display = 'none';
  }
}

function selectAllSchools() {
  allSchools.forEach(s => selectedSchoolIds.add(s.id));
  document.querySelectorAll('.school-checkbox').forEach(cb => { cb.checked = true; });
  updateBulkActionBar();
}

function clearSelection() {
  selectedSchoolIds.clear();
  document.querySelectorAll('.school-checkbox').forEach(cb => { cb.checked = false; });
  const master = document.getElementById('selectAllCheckbox');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateBulkActionBar();
}

function openBulkDeleteModal() {
  if (selectedSchoolIds.size === 0) return;
  document.getElementById('bulkDeleteCount').textContent = selectedSchoolIds.size;
  document.getElementById('bulkDeleteReason').value = '';
  openModal('bulkDeleteModal');
}

async function confirmBulkDelete() {
  const ids    = Array.from(selectedSchoolIds);
  const reason = document.getElementById('bulkDeleteReason').value.trim();

  const btn = document.querySelector('#bulkDeleteModal .btn-red');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }

  try {
    const res = await fetch('/api/schools', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids, reason })
    });

    let data;
    try { data = await res.json(); } catch (_) { data = {}; }

    if (!res.ok || data.error) {
      showToast('Error: ' + (data.error || 'Server error'), 'error');
      return;
    }

    showToast(
      `${data.deleted} school${data.deleted !== 1 ? 's' : ''} permanently deleted`,
      'success'
    );
    closeModal('bulkDeleteModal');
    clearSelection();
    loadSchools();
    loadDashboard();

  } catch (e) {
    showToast('Failed to delete schools', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑 Yes, Delete All Selected'; }
  }
}

// ── SEARCH / FILTER ──
function filterSchools() {
  schoolsCurrentPage = 1;
  const query = document.getElementById('searchInput').value.toLowerCase();
  const filtered = allSchools.filter(s =>
    (s.school_name    || '').toLowerCase().includes(query) ||
    (s.city_province  || '').toLowerCase().includes(query) ||
    (s.contact_person || '').toLowerCase().includes(query)
  );
  renderSchools(filtered);
}

// ── VIEW SINGLE SCHOOL ──
async function viewSchool(id) {
  try {
    const schoolRes = await fetch('/api/schools/' + id);
    if (!schoolRes.ok) throw new Error('School not found');
    const s = await schoolRes.json();
    currentSchoolId     = id;
    currentSchoolStatus = s.status || 'NEW_LEAD';

    // Fetch meetings separately — non-fatal, school details still show if this fails
    let meetings = [];
    try {
      const meetingsRes = await fetch('/api/schools/' + id + '/meetings');
      if (meetingsRes.ok) {
        const data = await meetingsRes.json();
        if (Array.isArray(data)) meetings = data;
      }
    } catch (_) {}

    // Find the most relevant meeting to show
    const upcoming = meetings.find(m => m.status === 'SCHEDULED' || m.status === 'RESCHEDULED');
    const lastDone  = meetings.find(m => m.status === 'DONE');

    let meetingBanner = '';
    if (upcoming) {
      meetingBanner = `
        <div style="margin-bottom:14px; padding:12px 14px;
          background:#e8e9f5; border:1.5px solid #1B1F6B;
          border-radius:8px; font-size:13px; color:#1B1F6B;
          display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:6px;">
            ${licon('calendar', 15)} <strong>Meeting Scheduled</strong> —
            ${formatDateDisplay(upcoming.meeting_date)} at ${formatTime(upcoming.meeting_time)}
            · ${upcoming.meeting_mode}
          </div>
          <button onclick="viewMeeting(${upcoming.id}); closeModal('schoolModal');"
            class="btn-ghost text-xs py-1 px-3" style="margin-left:12px;">
            View
          </button>
        </div>`;
    } else if (lastDone) {
      meetingBanner = `
        <div style="margin-bottom:14px; padding:12px 14px;
          background:#dcfce7; border:1.5px solid #16a34a;
          border-radius:8px; font-size:13px; color:#166534;">
          ${licon('check-circle', 14)} Presentation completed on ${formatDateDisplay(lastDone.meeting_date)}
        </div>`;
    }

    document.getElementById('modalSchoolName').textContent = s.school_name;
    document.getElementById('schoolModalBody').innerHTML = `
      ${meetingBanner}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 24px;">
        ${detailRow('Contact Person',  s.contact_person)}
        ${detailRow('Email',           s.email ? `<a href="mailto:${s.email}" style="color:var(--navy)">${s.email}</a>` : '—')}
        ${detailRow('Phone',           s.phone)}
        ${detailRow('Website',         s.website ? `<a href="${s.website}" target="_blank" style="color:var(--navy)">${s.website}</a>` : '—')}
        ${detailRow('Facebook',        s.facebook_page)}
        ${detailRow('Address',         s.address)}
        ${detailRow('City / Province', s.city_province)}
        ${detailRow('Region',          s.region)}
        ${detailRow('School Type',     s.school_type)}
        ${detailRow('Level Offered',   s.level_offered)}
        ${detailRow('Est. Students',   s.estimated_students)}
        ${detailRow('Status',          statusBadge(s.status))}
        ${detailRow('Last Contacted',  fmtDate(s.last_contacted))}
      </div>
      ${s.notes ? `
        <div style="margin-top:16px; padding:12px; background:#f9fafb;
          border-radius:8px; font-size:13px; color:#4b5563;">
          ${licon('file-text', 14)} ${s.notes}
        </div>` : ''}
    `;

    // Disable Generate Proposal if an email has already been sent
    const emailSent = ['EMAIL_SENT','INTERESTED','NOT_INTERESTED','WON','LOST','PROPOSAL_GENERATED']
      .includes(s.status);
    const genBtn = document.querySelector('#schoolModal .btn-red');
    if (genBtn) {
      if (emailSent) {
        genBtn.disabled = true;
        genBtn.style.opacity = '0.4';
        genBtn.style.cursor  = 'not-allowed';
        genBtn.title = 'Email already sent to this school';
      } else {
        genBtn.disabled = false;
        genBtn.style.opacity = '1';
        genBtn.style.cursor  = 'pointer';
        genBtn.title = '';
      }
    }

    // Show/hide promo-specific action buttons in the modal footer
    const resubBtn = document.getElementById('modal-resubscribe-btn');
    const retryBtn = document.getElementById('modal-retry-promo-btn');
    if (resubBtn) {
      resubBtn.style.display = (s.lead_type === 'PROMOTIONAL' && s.promo_unsubscribed) ? '' : 'none';
      resubBtn.onclick = () => resubscribeSchool(s.id);
    }
    if (retryBtn) {
      retryBtn.style.display = (s.lead_type === 'PROMOTIONAL' && !s.promo_unsubscribed) ? '' : 'none';
      retryBtn.onclick = () => retryPromoEmail(s.id);
    }

    openModal('schoolModal');
    lucide.createIcons();
  } catch (e) {
    showToast('Could not load school details', 'error');
  }
}

// ── DETAIL ROW HELPER ──
function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${value || '—'}</span>
    </div>`;
}

// ── OPEN EDIT MODAL ──
async function openEditModal(id) {
  try {
    const res = await fetch('/api/schools/' + id);
    if (!res.ok) throw new Error();
    const s = await res.json();

    document.getElementById('e-school_name').value        = s.school_name        || '';
    document.getElementById('e-contact_person').value     = s.contact_person     || '';
    document.getElementById('e-email').value              = s.email              || '';
    document.getElementById('e-phone').value              = s.phone              || '';
    document.getElementById('e-website').value            = s.website            || '';
    document.getElementById('e-facebook_page').value      = s.facebook_page      || '';
    document.getElementById('e-address').value            = s.address            || '';
    document.getElementById('e-city_province').value      = s.city_province      || '';
    document.getElementById('e-region').value             = s.region             || '';
    document.getElementById('e-school_type').value        = s.school_type        || '';
    document.getElementById('e-level_offered').value      = s.level_offered      || '';
    document.getElementById('e-estimated_students').value = s.estimated_students || '';
    document.getElementById('e-assigned_to').value        = s.assigned_to        || '';
    document.getElementById('e-status').value             = s.status             || 'NEW_LEAD';
    document.getElementById('e-notes').value              = s.notes              || '';

    closeModal('schoolModal');
    openModal('editSchoolModal');
  } catch (e) {
    showToast('Could not load school details', 'error');
  }
}

// ── SUBMIT EDIT SCHOOL ──
async function submitEditSchool() {
  const name = document.getElementById('e-school_name').value.trim();
  if (!name) {
    showToast('School name is required!', 'error');
    return;
  }

  const editEmail = document.getElementById('e-email').value.trim();
  if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  const payload = {
    school_name:        name,
    contact_person:     document.getElementById('e-contact_person').value.trim(),
    email:              document.getElementById('e-email').value.trim(),
    phone:              document.getElementById('e-phone').value.trim(),
    website:            document.getElementById('e-website').value.trim(),
    facebook_page:      document.getElementById('e-facebook_page').value.trim(),
    address:            document.getElementById('e-address').value.trim(),
    city_province:      document.getElementById('e-city_province').value.trim(),
    region:             document.getElementById('e-region').value.trim(),
    school_type:        document.getElementById('e-school_type').value,
    level_offered:      document.getElementById('e-level_offered').value,
    estimated_students: document.getElementById('e-estimated_students').value || null,
    status:             document.getElementById('e-status').value,
    notes:              document.getElementById('e-notes').value.trim(),
  };

  try {
    const res = await fetch('/api/schools/' + currentSchoolId, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    let data;
    try { data = await res.json(); } catch (_) { data = {}; }

    if (!res.ok || data.error) {
      showToast('Error: ' + (data.error || 'Server error'), 'error');
      return;
    }

    showToast('School details updated!', 'success');
    closeModal('editSchoolModal');
    closeModal('schoolModal');
    loadSchools();
    loadDashboard();
    await viewSchool(currentSchoolId);
  } catch (e) {
    showToast('Failed to update school', 'error');
  }
}

// ── ADD SCHOOL ──
async function addSchool() {
  const name  = document.getElementById('f-school_name').value.trim();
  const email = document.getElementById('f-email').value.trim();

  if (!name) {
    showToast('School name is required!', 'error');
    return;
  }

  // ── CHECK DUPLICATE EMAIL ──
  if (email) {
    try {
      const checkRes = await fetch(
        '/api/schools/check-email/' + encodeURIComponent(email)
      );
      const checkData = await checkRes.json();

      if (checkData.exists) {
        const proceed = await showConfirmModal(
          '<i data-lucide="alert-triangle" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;color:#d97706;"></i> Duplicate Email Detected',
          `The email <strong>${email}</strong> is already registered under <strong>${checkData.school_name}</strong>.<br><br>This might be a duplicate entry. Do you still want to add this school?`,
          'Add Anyway',
          'btn-navy'
        );
        if (!proceed) return;
      }
    } catch (e) {
      console.error('Could not check duplicate email');
    }
  }

  const payload = {
    school_name:        name,
    contact_person:     document.getElementById('f-contact_person').value,
    email:              document.getElementById('f-email').value.trim(),
    phone:              document.getElementById('f-phone').value,
    website:            document.getElementById('f-website').value,
    facebook_page:      document.getElementById('f-facebook_page').value,
    address:            document.getElementById('f-address').value,
    city_province:      document.getElementById('f-city_province').value,
    region:             document.getElementById('f-region').value,
    school_type:        document.getElementById('f-school_type').value,
    level_offered:      document.getElementById('f-level_offered').value,
    estimated_students: document.getElementById('f-estimated_students').value || null,
    notes:              document.getElementById('f-notes').value,
    mode:               window.currentMode || 'school',
  };

  try {
    const res = await fetch('/api/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('School lead saved!', 'success');
    clearForm();
    showTab('schools');

  } catch (e) {
    showToast('Failed to save school', 'error');
  }
}

// ── CLEAR FORM ──
function clearForm() {
  const fields = [
    'school_name', 'contact_person', 'email', 'phone',
    'website', 'facebook_page', 'address', 'city_province',
    'region', 'school_type', 'level_offered',
    'estimated_students', 'notes'
  ];
  fields.forEach(f => {
    const el = document.getElementById('f-' + f);
    if (el) el.value = '';
  });
}

// ── TODAY'S MEETINGS ALERT ──
async function loadTodaysMeetings() {
  try {
    const res      = await fetch('/api/meetings/today');
    const meetings = await res.json();
    const container = document.getElementById('todaysMeetings');
    if (!container) return;

    if (!meetings.length) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const meetingList = meetings.map(m => `
      <span style="display:inline-flex; align-items:center; gap:5px;
        background:rgba(255,255,255,0.2); border-radius:6px;
        padding:3px 9px; font-size:12px; font-weight:600; color:#fff;">
        ${licon('clock', 12)}
        ${m.school_name} &mdash; ${formatTime(m.meeting_time)}
      </span>
    `).join('');

    container.innerHTML = `
      <div onclick="showTab('calendar')"
        style="background:linear-gradient(135deg,#1B1F6B 0%,#2d3494 100%);
          border-radius:12px; padding:16px 20px; margin-bottom:24px;
          display:flex; align-items:center; gap:16px;
          cursor:pointer; transition:opacity 0.15s; box-shadow:0 4px 16px rgba(27,31,107,0.25);"
        onmouseover="this.style.opacity='0.92'"
        onmouseout="this.style.opacity='1'">

        <!-- Icon badge -->
        <div style="flex-shrink:0; width:46px; height:46px; border-radius:12px;
          background:rgba(255,255,255,0.15); display:flex; align-items:center;
          justify-content:center; border:1.5px solid rgba(255,255,255,0.25);">
          <i data-lucide="calendar-clock" style="width:22px;height:22px;color:#fff;"></i>
        </div>

        <!-- Text -->
        <div style="flex:1; min-width:0;">
          <div style="font-size:14px; font-weight:700; color:#fff; margin-bottom:6px;">
            You have ${meetings.length} meeting${meetings.length > 1 ? 's' : ''} today
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${meetingList}
          </div>
        </div>

        <!-- CTA -->
        <div style="flex-shrink:0; display:flex; align-items:center; gap:6px;
          background:rgba(255,255,255,0.15); border:1.5px solid rgba(255,255,255,0.3);
          border-radius:8px; padding:7px 14px;
          font-size:12px; font-weight:700; color:#fff; white-space:nowrap;">
          View Calendar
          <i data-lucide="arrow-right" style="width:13px;height:13px;"></i>
        </div>

      </div>
    `;
    lucide.createIcons();
  } catch (e) {
    console.error('Could not load today meetings');
  }
}

// ── DELETE SCHOOL ──
let deleteTargetId   = null;
let deleteTargetName = null;

function deleteSchool(id) {
  deleteTargetId   = id;
  deleteTargetName = document.getElementById('modalSchoolName').textContent;

  document.getElementById('deleteSchoolName').textContent =
    deleteTargetName;
  document.getElementById('deleteReason').value = '';

  closeModal('schoolModal');
  openModal('deleteSchoolModal');
}

async function confirmDeleteSchool() {
  if (!deleteTargetId) return;

  const reason = document.getElementById('deleteReason').value;

  try {
    const res  = await fetch('/api/schools/' + deleteTargetId, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reason })
    });
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('Record permanently deleted', 'success');
    closeModal('deleteSchoolModal');
    loadSchools();
    loadDashboard();

  } catch (e) {
    showToast('Failed to delete record', 'error');
  }
}