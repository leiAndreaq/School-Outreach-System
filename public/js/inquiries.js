// ── GLOBAL STATE ──
let allInquiries = [];
let currentInquiryId = null;
let currentFilter = 'PENDING';

// ── PAGINATION STATE ──
const INQUIRIES_PAGE_SIZE = 5;
let inquiriesCurrentPage  = 1;
let inquiriesFilteredList = [];

// ── LOAD ALL INQUIRIES ──
async function loadInquiries() {
  try {
    const res = await fetch('/api/inquiries');
    allInquiries = await res.json();
    renderInquiries(currentFilter);
    checkPendingInquiries();
  } catch (e) {
    showToast('Could not load inquiries', 'error');
  }
}

// ── FILTER INQUIRIES ──
function filterInquiries(status) {
  currentFilter = status;
  inquiriesCurrentPage = 1;

  ['PENDING','APPROVED','DISMISSED','ALL'].forEach(s => {
    const btn = document.getElementById('filter-' + s);
    if (!btn) return;
    if (s === status) {
      btn.classList.add('inq-filter-active');
    } else {
      btn.classList.remove('inq-filter-active');
    }
  });

  renderInquiries(status);
}

// ── RENDER INQUIRIES TABLE ──
function renderInquiries(filter) {
  const tbody = document.getElementById('inquiriesTable');
  const pagEl = document.getElementById('inquiriesPagination');

  const filtered = filter === 'ALL'
    ? allInquiries
    : allInquiries.filter(i => i.status === filter);

  inquiriesFilteredList = filtered;

  const countEl = document.getElementById('inquiryCount');
  if (countEl) countEl.textContent = filtered.length;

  if (!filtered.length) {
    const messages = {
      PENDING:   'No pending inquiries',
      APPROVED:  'No approved inquiries yet',
      DISMISSED: 'No dismissed inquiries',
      ALL:       'No inquiries yet'
    };
    tbody.innerHTML = emptyState(
      'inbox',
      messages[filter] || 'No inquiries',
      filter === 'PENDING' ? 'New form submissions will appear here' : ''
    );
    if (pagEl) pagEl.style.display = 'none';
    lucide.createIcons();
    return;
  }

  const total      = filtered.length;
  const totalPages = Math.ceil(total / INQUIRIES_PAGE_SIZE);
  if (inquiriesCurrentPage > totalPages) inquiriesCurrentPage = totalPages;

  const start    = (inquiriesCurrentPage - 1) * INQUIRIES_PAGE_SIZE;
  const pageSlice = filtered.slice(start, start + INQUIRIES_PAGE_SIZE);

  tbody.innerHTML = pageSlice.map(i => `
    <tr>
      <td class="px-6 py-4 font-medium text-gray-900">${i.school_name}</td>
      <td class="px-6 py-4 text-gray-600">${i.contact_person}</td>
      <td class="px-6 py-4">
        <a href="mailto:${i.email}" style="color:var(--navy)">${i.email}</a>
      </td>
      <td class="px-6 py-4 text-gray-600">${i.preferred_date ? formatInquiryDate(i.preferred_date) : '—'}</td>
      <td class="px-6 py-4">
        <span class="badge badge-default">${i.preferred_mode || 'ONLINE'}</span>
      </td>
      <td class="px-6 py-4">${inquiryStatusBadge(i.status)}</td>
      <td class="px-6 py-4 text-gray-600">${formatInquiryDate(i.created_at)}</td>
      <td class="px-6 py-4 text-center">
        <button
          onclick="viewInquiry(${i.id})"
          class="inline-flex items-center gap-2 bg-navy text-white
                 text-xs font-semibold px-3 py-2 rounded-lg
                 border border-navy hover:bg-white hover:text-navy
                 transition shadow-sm">
          Review
        </button>
      </td>
    </tr>
  `).join('');

  renderInquiriesPagination(total, totalPages);
  lucide.createIcons();
}

// ── PAGINATION RENDER ──
function renderInquiriesPagination(total, totalPages) {
  const el = document.getElementById('inquiriesPagination');
  if (!el) return;

  if (totalPages <= 1) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'flex';

  const start = (inquiriesCurrentPage - 1) * INQUIRIES_PAGE_SIZE + 1;
  const end   = Math.min(inquiriesCurrentPage * INQUIRIES_PAGE_SIZE, total);

  const btnBase = 'width:32px;height:32px;border-radius:6px;font-size:13px;cursor:pointer;transition:all 0.15s;';

  const MAX_VISIBLE = 5;
  let winStart = Math.max(1, inquiriesCurrentPage - Math.floor(MAX_VISIBLE / 2));
  let winEnd   = winStart + MAX_VISIBLE - 1;
  if (winEnd > totalPages) {
    winEnd   = totalPages;
    winStart = Math.max(1, winEnd - MAX_VISIBLE + 1);
  }

  let pageButtons = '';
  for (let i = winStart; i <= winEnd; i++) {
    const active = i === inquiriesCurrentPage;
    pageButtons += `<button onclick="goToInquiriesPage(${i})" style="${btnBase}
      font-weight:${active ? '700' : '500'};
      background:${active ? '#201658' : 'transparent'};
      color:${active ? '#fff' : '#374151'};
      border:1px solid ${active ? '#201658' : '#d1d5db'};">${i}</button>`;
  }

  const onFirst = inquiriesCurrentPage === 1;
  const onLast  = inquiriesCurrentPage === totalPages;

  const navBtn = (onclick, disabled, label) =>
    `<button onclick="${onclick}" ${disabled ? 'disabled' : ''}
      style="${btnBase} background:transparent; border:1px solid #d1d5db;
        color:${disabled ? '#9ca3af' : '#374151'};
        cursor:${disabled ? 'not-allowed' : 'pointer'}; font-size:11px;">${label}</button>`;

  el.innerHTML = `
    <div style="display:flex;gap:4px;align-items:center;">
      ${navBtn(`goToInquiriesPage(1)`,                       onFirst, '&laquo;')}
      ${navBtn(`goToInquiriesPage(${inquiriesCurrentPage - 1})`, onFirst, '&lsaquo;')}
      ${pageButtons}
      ${navBtn(`goToInquiriesPage(${inquiriesCurrentPage + 1})`, onLast,  '&rsaquo;')}
      ${navBtn(`goToInquiriesPage(${totalPages})`,            onLast,  '&raquo;')}
    </div>
    <span>${start}–${end} of ${total} inquir${total !== 1 ? 'ies' : 'y'}</span>
  `;
}

// ── GO TO PAGE ──
function goToInquiriesPage(page) {
  const totalPages = Math.ceil(inquiriesFilteredList.length / INQUIRIES_PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  inquiriesCurrentPage = page;
  renderInquiries(currentFilter);
}

// ── VIEW INQUIRY ──
async function viewInquiry(id) {
  try {
    const res = await fetch('/api/inquiries/' + id);
    const i = await res.json();
    currentInquiryId = id;

    document.getElementById('inquiryModalBody').innerHTML = `

      <!-- School Info -->
      <div style="margin-bottom:20px;">
        <div style="font-size:11px; font-weight:700; color:#9ca3af;
          letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px;">
          School Information
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 24px;">
          ${detailRow('School Name',   i.school_name)}
          ${detailRow('School Type',   i.school_type)}
          ${detailRow('Level Offered', i.level_offered)}
          ${detailRow('Est. Students', i.estimated_students)}
          ${detailRow('City/Province', i.city_province)}
          ${detailRow('Region',        i.region)}
        </div>
      </div>

      <!-- Contact Info -->
      <div style="margin-bottom:20px; padding-top:16px; border-top:1px solid #f3f4f6;">
        <div style="font-size:11px; font-weight:700; color:#9ca3af;
          letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px;">
          Contact Person
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 24px;">
          ${detailRow('Name',     i.contact_person)}
          ${detailRow('Position', i.position)}
          ${detailRow('Email',
            `<a href="mailto:${i.email}" style="color:var(--navy)">${i.email}</a>`)}
          ${detailRow('Phone',    i.phone)}
        </div>
      </div>

      <!-- Schedule Preference -->
      <div style="margin-bottom:20px; padding-top:16px; border-top:1px solid #f3f4f6;">
        <div style="font-size:11px; font-weight:700; color:#9ca3af;
          letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px;">
          Schedule Preference
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 24px;">
          ${detailRow('Preferred Date',
            i.preferred_date ? formatInquiryDate(i.preferred_date) : '—')}
          ${detailRow('Preferred Time', i.preferred_time)}
          ${detailRow('Meeting Mode',   i.preferred_mode)}
          ${detailRow('Heard From',     i.heard_from)}
        </div>
      </div>

      <!-- Message -->
      ${i.message ? `
        <div style="padding-top:16px; border-top:1px solid #f3f4f6;">
          <div style="font-size:11px; font-weight:700; color:#9ca3af;
            letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;">
            Message
          </div>
          <div style="background:#f9fafb; border-radius:8px; padding:14px;
            font-size:13px; color:#4b5563; line-height:1.7;">
            ${i.message}
          </div>
        </div>` : ''}

      <!-- Dismissal reason -->
      ${i.rejection_reason ? `
        <div style="margin-top:16px; padding:12px; background:#fee2e2;
          border-radius:8px; font-size:13px; color:#991b1b;">
          Dismissed — ${i.rejection_reason}
        </div>` : ''}

      <!-- Status indicator -->
      <div style="margin-top:16px; text-align:right;">
        ${inquiryStatusBadge(i.status)}
      </div>
    `;

    const footer = document.getElementById('inquiryModalFooter');

    if (i.status === 'PENDING') {
      footer.innerHTML = `
        <button onclick="closeModal('inquiryModal')" class="btn-ghost">Close</button>
        <button onclick="deleteInquiry(${i.id}, '${i.contact_person}')"
          class="btn-ghost text-sm" style="color:#991b1b; margin-right:auto; display:inline-flex; align-items:center; gap:4px;">
          ${licon('trash-2')} Delete
        </button>
        <button onclick="openDismissModal()" class="btn-red text-sm" style="color:#ffffff;">
          Dismiss
        </button>
        <button onclick="approveInquiry()" class="btn-navy">
          Approve &amp; Convert to Lead
        </button>
      `;
    } else {
      footer.innerHTML = `
        <button onclick="closeModal('inquiryModal')" class="btn-ghost">Close</button>
        <button onclick="deleteInquiry(${i.id}, '${i.contact_person}')"
          class="btn-ghost text-sm" style="color:#991b1b; margin-right:auto; display:inline-flex; align-items:center; gap:4px;">
          ${licon('trash-2')} Delete
        </button>
      `;
    }

    openModal('inquiryModal');
    lucide.createIcons();
  } catch (e) {
    showToast('Could not load inquiry', 'error');
  }
}

// ── APPROVE INQUIRY ──
async function approveInquiry() {
  if (!currentInquiryId) return;

  try {
    const res = await fetch(
      '/api/inquiries/' + currentInquiryId + '/approve',
      { method: 'POST' }
    );
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('Inquiry approved! School lead created.', 'success');
    closeModal('inquiryModal');
    loadInquiries();
    loadDashboard();

    setTimeout(() => { showTab('schools'); }, 1500);

  } catch (e) {
    showToast('Failed to approve inquiry', 'error');
  }
}

// ── OPEN DISMISS MODAL ──
function openDismissModal() {
  document.getElementById('dismissReason').value = '';
  closeModal('inquiryModal');
  openModal('dismissModal');
}

// ── CONFIRM DISMISS ──
async function confirmDismiss() {
  if (!currentInquiryId) return;

  const reason = document.getElementById('dismissReason').value.trim();

  try {
    const res = await fetch(
      '/api/inquiries/' + currentInquiryId + '/dismiss',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      }
    );
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('Inquiry dismissed', '');
    closeModal('dismissModal');
    loadInquiries();
    checkPendingInquiries();

  } catch (e) {
    showToast('Failed to dismiss inquiry', 'error');
  }
}

// ── HELPERS ──

function formatInquiryDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day:   'numeric',
    year:  'numeric'
  });
}

function inquiryStatusBadge(status) {
  const map = {
    'PENDING':   'background:#fef3c7; color:#92400e;',
    'APPROVED':  'background:#dcfce7; color:#166534;',
    'DISMISSED': 'background:#fee2e2; color:#991b1b;',
  };
  const style = map[status] || 'background:#f3f4f6; color:#374151;';
  return `<span class="badge" style="${style}">${status}</span>`;
}

// ── DELETE INQUIRY ──
let deleteInquiryTargetId   = null;
let deleteInquiryTargetName = null;

function deleteInquiry(id, name) {
  deleteInquiryTargetId   = id;
  deleteInquiryTargetName = name;

  document.getElementById('deleteInquiryName').textContent = name;
  closeModal('inquiryModal');
  openModal('deleteInquiryModal');
}

async function confirmDeleteInquiry() {
  if (!deleteInquiryTargetId) return;

  try {
    const res  = await fetch(
      '/api/inquiries/' + deleteInquiryTargetId,
      {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: 'Right to Erasure Request' })
      }
    );
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('Inquiry permanently deleted', 'success');
    closeModal('deleteInquiryModal');
    loadInquiries();
    checkPendingInquiries();

  } catch (e) {
    showToast('Failed to delete inquiry', 'error');
  }
}
