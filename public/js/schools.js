// ── GLOBAL SCHOOLS DATA ──
let allSchools = [];

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

    // Show recent 8 schools
    const recent = schools.slice(0, 8);
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
    const res = await fetch('/api/schools/' + id);
    const s = await res.json();
    currentSchoolId = id;

    document.getElementById('modalSchoolName').textContent = s.school_name;
    document.getElementById('schoolModalBody').innerHTML = `
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

// ── ADD SCHOOL ──
async function addSchool() {
  const name = document.getElementById('f-school_name').value.trim();

  if (!name) {
    showToast('School name is required!', 'error');
    return;
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