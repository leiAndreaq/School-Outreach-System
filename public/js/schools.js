// ── GLOBAL SCHOOLS DATA ──
let allSchools = [];
let selectedSchoolIds = new Set();

// ── LOAD DASHBOARD ──
async function loadDashboard() {
  try {
    const res = await fetch('/api/schools');
    const schools = await res.json();
    allSchools = schools;

    // Update stat numbers
    document.getElementById('stat-total').textContent = schools.length;
    document.getElementById('stat-new').textContent =
      schools.filter(s => !s.status || s.status === 'NEW_LEAD').length;
    document.getElementById('stat-sent').textContent =
      schools.filter(s => s.status === 'EMAIL_SENT').length;
    document.getElementById('stat-interested').textContent =
      schools.filter(s => s.status === 'INTERESTED').length;

    // Show recent 5 schools
    const recent = schools.slice(0, 5);
    const tbody = document.getElementById('dashboardTable');

    if (!recent.length) {
      tbody.innerHTML = emptyState(
        '🏫',
        'No leads yet',
        'Add your first school lead to get started'
      );
      return;
    }

    tbody.innerHTML = recent.map(s => `
      <tr>
        <td>${s.school_name}</td>
        <td>${s.city_province || '—'}</td>
        <td>${s.school_type || '—'}</td>
        <td>${statusBadge(s.status)}</td>
        <td>
          <button
            onclick="viewSchool(${s.id})"
            class="btn-ghost text-xs py-1 px-3">
            View
          </button>
        </td>
      </tr>
    `).join('');

    // Load today's meetings alert
    loadTodaysMeetings();

  } catch (e) {
    showToast('Could not load dashboard', 'error');
  }
}

// ── LOAD ALL SCHOOLS ──
async function loadSchools() {
  try {
    const res = await fetch('/api/schools');
    allSchools = await res.json();
    renderSchools(allSchools);
  } catch (e) {
    showToast('Could not load schools', 'error');
  }
}

// ── RENDER SCHOOLS TABLE ──
function renderSchools(schools) {
  selectedSchoolIds.clear();
  const master = document.getElementById('selectAllCheckbox');
  if (master) { master.checked = false; master.indeterminate = false; }
  updateBulkActionBar();

  const tbody = document.getElementById('schoolsTable');

  if (!schools.length) {
    tbody.innerHTML = emptyState(
      '📋',
      'No schools found',
      'Try a different search or add a new school'
    );
    return;
  }

  tbody.innerHTML = schools.map(s => `
    <tr>
      <td style="width:40px; padding:8px 0 8px 16px;">
        <input type="checkbox" class="school-checkbox" value="${s.id}"
          onchange="toggleSchoolSelect(${s.id}, this)"
          style="width:16px; height:16px; cursor:pointer; accent-color:#1B1F6B;">
      </td>
      <td>${s.school_name}</td>
      <td>${s.contact_person || '—'}</td>
      <td>${s.city_province || '—'}</td>
      <td>${s.level_offered || '—'}</td>
      <td>${statusBadge(s.status)}</td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button
            onclick="viewSchool(${s.id})"
            class="btn-ghost text-xs py-1 px-3">
            👁 View
          </button>
          <button
            onclick="openStatusModal(${s.id}, '${s.status || 'NEW_LEAD'}')"
            class="btn-outline text-xs py-1 px-3">
            ✏ Status
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── MULTI-SELECT ──
function toggleSchoolSelect(id, cb) {
  if (cb.checked) selectedSchoolIds.add(id);
  else selectedSchoolIds.delete(id);
  updateSelectAllState();
  updateBulkActionBar();
}

function toggleSelectAll(masterCb) {
  document.querySelectorAll('.school-checkbox').forEach(cb => {
    cb.checked = masterCb.checked;
    const id = parseInt(cb.value);
    if (masterCb.checked) selectedSchoolIds.add(id);
    else selectedSchoolIds.delete(id);
  });
  updateBulkActionBar();
}

function updateSelectAllState() {
  const master = document.getElementById('selectAllCheckbox');
  if (!master) return;
  const all     = document.querySelectorAll('.school-checkbox');
  const checked = document.querySelectorAll('.school-checkbox:checked');
  if (checked.length === 0) {
    master.checked = false;
    master.indeterminate = false;
  } else if (checked.length === all.length) {
    master.checked = true;
    master.indeterminate = false;
  } else {
    master.checked = false;
    master.indeterminate = true;
  }
}

function updateBulkActionBar() {
  const bar   = document.getElementById('bulkActionBar');
  const count = document.getElementById('selectedCount');
  if (!bar) return;
  if (selectedSchoolIds.size > 0) {
    bar.style.display = 'flex';
    count.textContent = `${selectedSchoolIds.size} school${selectedSchoolIds.size > 1 ? 's' : ''} selected`;
  } else {
    bar.style.display = 'none';
  }
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
      `🗑 ${data.deleted} school${data.deleted !== 1 ? 's' : ''} permanently deleted`,
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
    currentSchoolId = id;

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
          <div>
            <strong>📅 Meeting Scheduled</strong> —
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
          ✅ Presentation completed on ${formatDateDisplay(lastDone.meeting_date)}
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
        ${detailRow('Assigned To',     s.assigned_to)}
        ${detailRow('Status',          statusBadge(s.status))}
        ${detailRow('Last Contacted',  fmtDate(s.last_contacted))}
      </div>
      ${s.notes ? `
        <div style="margin-top:16px; padding:12px; background:#f9fafb;
          border-radius:8px; font-size:13px; color:#4b5563;">
          📝 ${s.notes}
        </div>` : ''}
    `;

    openModal('schoolModal');
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
    assigned_to:        document.getElementById('e-assigned_to').value.trim(),
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

    showToast('✅ School details updated!', 'success');
    closeModal('editSchoolModal');
    loadSchools();
    loadDashboard();
    viewSchool(currentSchoolId);
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
        const proceed = confirm(
          `⚠️ Duplicate Email Detected!\n\n` +
          `The email "${email}" is already registered under:\n` +
          `"${checkData.school_name}"\n\n` +
          `This might be a duplicate entry.\n` +
          `Do you still want to add this school?`
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
    email:              document.getElementById('f-email').value,
    phone:              document.getElementById('f-phone').value,
    website:            document.getElementById('f-website').value,
    facebook_page:      document.getElementById('f-facebook_page').value,
    address:            document.getElementById('f-address').value,
    city_province:      document.getElementById('f-city_province').value,
    region:             document.getElementById('f-region').value,
    school_type:        document.getElementById('f-school_type').value,
    level_offered:      document.getElementById('f-level_offered').value,
    estimated_students: document.getElementById('f-estimated_students').value || null,
    assigned_to:        document.getElementById('f-assigned_to').value,
    notes:              document.getElementById('f-notes').value,
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

    showToast('✅ School lead saved!', 'success');
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
    'estimated_students', 'assigned_to', 'notes'
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
    container.innerHTML = `
      <div onclick="showTab('calendar')"
        style="background:#e8e9f5; border:1.5px solid #1B1F6B;
          border-radius:10px; padding:14px 20px; margin-bottom:24px;
          display:flex; align-items:center; justify-content:space-between;
          cursor:pointer; transition:background 0.15s;"
        onmouseover="this.style.background='#d4d6eb'"
        onmouseout="this.style.background='#e8e9f5'">
        <div style="font-size:13px; font-weight:700; color:#1B1F6B;">
          📅 You have ${meetings.length} meeting${meetings.length > 1 ? 's' : ''} today
        </div>
        <div style="font-size:12px; color:#1B1F6B; opacity:0.7;">
          View Calendar →
        </div>
      </div>
    `;
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

    showToast('🗑 Record permanently deleted', 'success');
    closeModal('deleteSchoolModal');
    loadSchools();
    loadDashboard();

  } catch (e) {
    showToast('Failed to delete record', 'error');
  }
}