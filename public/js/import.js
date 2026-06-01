// ── STATE ──
let pendingImportRows     = [];
let pendingImportFilename = '';
let pendingSchoolIds      = [];

// ── STEP 1: Upload CSV → Preview Modal ──
async function importCSV(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  document.getElementById('importResult').innerHTML = `
    <div style="color:#9ca3af; font-size:13px; display:flex; align-items:center; gap:6px;">
      ${licon('loader', 14)} Parsing CSV, please wait...
    </div>`;
  lucide.createIcons();

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res  = await fetch('/api/import-csv/preview', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.error || !data.rows || !data.rows.length) {
      document.getElementById('importResult').innerHTML = `
        <div style="padding:16px; border-radius:8px; background:#fee2e2; border:1px solid #fca5a5;">
          <div style="font-weight:600; color:#991b1b; font-size:14px;">${licon('x-circle', 15)} No valid rows found</div>
          <div style="color:#991b1b; font-size:13px; margin-top:4px;">${data.error || 'Check your CSV format and try again.'}</div>
        </div>`;
      lucide.createIcons();
      return;
    }

    pendingImportRows     = data.rows;
    pendingImportFilename = data.filename || file.name;

    document.getElementById('importResult').innerHTML = `
      <div style="color:#6b7280; font-size:13px; margin-top:4px;">
        ${licon('info', 14)} ${data.rows.length} school(s) found — review in the preview window.
      </div>`;
    lucide.createIcons();

    showImportPreviewModal(data.rows);

  } catch (e) {
    document.getElementById('importResult').innerHTML = `
      <div style="padding:16px; border-radius:8px; background:#fee2e2; border:1px solid #fca5a5;">
        <div style="font-weight:600; color:#991b1b; font-size:14px;">${licon('x-circle', 15)} Import Failed</div>
        <div style="color:#991b1b; font-size:13px; margin-top:4px;">Please check your CSV format and try again.</div>
      </div>`;
    lucide.createIcons();
    showToast('Import failed', 'error');
  }
}

// ── SHOW PREVIEW MODAL ──
function showImportPreviewModal(rows) {
  document.getElementById('previewCount').textContent = rows.length;

  const tbody = document.getElementById('importPreviewTable');
  tbody.innerHTML = rows.map((r, i) => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:8px 12px; color:#9ca3af;">${i + 1}</td>
      <td style="padding:8px 12px; font-weight:600; color:#1B1F6B;">${r.school_name || '—'}</td>
      <td style="padding:8px 12px; color:#374151;">${r.contact_person || '—'}</td>
      <td style="padding:8px 12px; color:#374151;">${r.email || '<span style="color:#ef4444;">No email</span>'}</td>
      <td style="padding:8px 12px; color:#374151;">${r.city_province || '—'}</td>
    </tr>
  `).join('');

  openModal('importPreviewModal');
  lucide.createIcons();
}

// ── STEP 2: Confirm → Save to DB ──
async function confirmImport() {
  if (!pendingImportRows.length) return;

  const confirmBtn = document.querySelector('#importPreviewModal .btn-navy');
  if (confirmBtn) {
    confirmBtn.disabled   = true;
    confirmBtn.innerHTML  = `${licon('loader', 14)} Importing…`;
  }

  try {
    const res  = await fetch('/api/import-csv/confirm', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rows: pendingImportRows, filename: pendingImportFilename })
    });
    const data = await res.json();

    closeModal('importPreviewModal');

    pendingSchoolIds = data.school_ids || [];

    document.getElementById('importResult').innerHTML = `
      <div style="padding:16px; border-radius:8px; background:#dcfce7; border:1px solid #86efac;">
        <div style="font-weight:600; color:#166534; font-size:14px; display:flex; align-items:center; gap:5px;">
          ${licon('check-circle', 15)} Import Complete
        </div>
        <div style="color:#166534; font-size:13px; margin-top:4px;">
          Successfully imported <strong>${data.imported}</strong> school(s).
        </div>
        ${data.errors.length ? `<div style="color:#991b1b; font-size:12px; margin-top:6px;">${licon('alert-triangle', 13)} ${data.errors.length} row(s) skipped.</div>` : ''}
      </div>`;
    lucide.createIcons();

    showToast('Imported ' + data.imported + ' schools!', 'success');
    loadDashboard();
    loadImportHistory();
    pendingImportRows = [];

    // Open bulk email modal if any schools were imported with emails
    if (pendingSchoolIds.length > 0) {
      setTimeout(() => openBulkEmailModal(pendingSchoolIds), 500);
    }

  } catch (e) {
    showToast('Import confirmation failed', 'error');
    if (confirmBtn) {
      confirmBtn.disabled  = false;
      confirmBtn.innerHTML = `${licon('check', 14)} Confirm Imported Schools`;
    }
  }
}

// ── STEP 3: Bulk Email Modal ──
function openBulkEmailModal(schoolIds) {
  pendingSchoolIds = schoolIds;

  document.getElementById('bulkEmailCount').textContent = schoolIds.length;
  document.getElementById('bulkEmailProgress').style.display = 'none';
  document.getElementById('bulkEmailResult').style.display   = 'none';
  document.getElementById('bulkSendBtn').disabled = false;

  // Show template preview (sample with placeholder)
  document.getElementById('bulkEmailPreview').textContent =
    `Subject: Invitation for School Management and Learning Management System Presentation

Dear [Contact Person / School Administrator],

Good day.

I hope this message finds you well. We are respectfully reaching out to [School Name] to introduce ThinkTANQ's School Management System (SMS) and Learning Management System (LMS) — designed to modernise school operations and academic delivery for private schools across the Philippines.

ThinkTANQ is built to help schools like [School Name] simplify day-to-day administration while empowering teachers, students, and parents through technology. Our platform covers:

• Enrollment & Admissions Management
• Student Records, Attendance & Grading
• Digital Report Cards & Transcript Generation
• Learning Modules, Assessments & e-Library
• AI-Assisted Lesson Planning & Item Analysis
• Parent & Student Portal
• Multi-Campus Monitoring & Analytics Dashboard
• School Inventory & ID Generation

We would like to invite [School Name] to a free 20–30 minute online or onsite presentation — at absolutely no commitment — so we can demonstrate exactly how ThinkTANQ can benefit your institution.

Please reply to this email with your preferred date and time and we will arrange a convenient schedule.

We currently offer an introductory arrangement for qualified partner schools and would be honoured to discuss how we can support your school's growth and future-readiness.

If you are not the appropriate person to receive this message, we would appreciate being directed to the right administrator. Should you wish to opt out of further communications, simply reply "unsubscribe" and we will respectfully remove your contact.

Respectfully yours,

Accoutre AI Business Creation & Management OPC
accoutre.ai.ph@gmail.com

─────────────────────────────────────────
Note: Each email will be personalised with your school's name and contact person.`;

  openModal('bulkEmailModal');
  lucide.createIcons();
}

// ── STEP 4: Send Bulk Emails ──
async function sendBulkPromoEmails() {
  if (!pendingSchoolIds.length) return;

  const sendBtn = document.getElementById('bulkSendBtn');
  sendBtn.disabled = true;

  document.getElementById('bulkEmailProgress').style.display = 'block';
  document.getElementById('bulkEmailResult').style.display   = 'none';

  try {
    const res  = await fetch('/api/bulk-promo-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ school_ids: pendingSchoolIds })
    });
    const data = await res.json();

    document.getElementById('bulkEmailProgress').style.display = 'none';

    const resultEl = document.getElementById('bulkEmailResult');
    resultEl.style.display = 'block';

    if (data.sent > 0) {
      resultEl.innerHTML = `
        <div style="padding:12px 14px; background:#dcfce7; border-radius:8px; font-size:13px; color:#166534;">
          ${licon('check-circle', 14)} <strong>${data.sent} email(s) sent successfully!</strong>
          ${data.failed > 0 ? `<br/><span style="color:#991b1b;">${data.failed} failed.</span>` : ''}
        </div>`;
      showToast(data.sent + ' promotional email(s) sent!', 'success');
    } else {
      resultEl.innerHTML = `
        <div style="padding:12px 14px; background:#fee2e2; border-radius:8px; font-size:13px; color:#991b1b;">
          ${licon('alert-triangle', 14)} No emails were sent. Check SMTP settings.
          ${data.errors.length ? `<br/><span style="font-size:12px;">${data.errors[0]}</span>` : ''}
        </div>`;
      showToast('Bulk send failed', 'error');
    }

    document.getElementById('bulkEmailFooter').innerHTML = `
      <button onclick="closeModal('bulkEmailModal')" class="btn-navy">Done</button>`;
    lucide.createIcons();

    loadDashboard();

  } catch (e) {
    document.getElementById('bulkEmailProgress').style.display = 'none';
    showToast('Bulk email failed', 'error');
    sendBtn.disabled = false;
  }
}

// ── IMPORT HISTORY PAGINATION STATE ──
const IMPORT_HISTORY_PAGE_SIZE = 5;
let importHistoryPage    = 1;
let importHistoryAllLogs = [];

// ── IMPORT HISTORY ──
async function loadImportHistory() {
  const container = document.getElementById('importHistoryList');
  if (!container) return;

  try {
    const res  = await fetch('/api/import-logs');
    importHistoryAllLogs = await res.json();
    importHistoryPage    = 1;
    renderImportHistoryPage();
  } catch (e) {
    container.innerHTML = `
      <div style="color:#9ca3af; font-size:13px; text-align:center; padding:32px 0;">Could not load history</div>`;
  }
}

function renderImportHistoryPage() {
  const container = document.getElementById('importHistoryList');
  const pagEl     = document.getElementById('importHistoryPagination');
  const logs      = importHistoryAllLogs;

  if (!logs.length) {
    container.innerHTML = `
      <div style="color:#9ca3af; font-size:13px; text-align:center; padding:32px 0;">No imports yet</div>`;
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  const total      = logs.length;
  const totalPages = Math.ceil(total / IMPORT_HISTORY_PAGE_SIZE);
  if (importHistoryPage > totalPages) importHistoryPage = totalPages;

  const start = (importHistoryPage - 1) * IMPORT_HISTORY_PAGE_SIZE;
  const page  = logs.slice(start, start + IMPORT_HISTORY_PAGE_SIZE);

  container.innerHTML = page.map(log => `
    <div style="display:flex; align-items:center; justify-content:space-between;
      padding:10px 0; border-bottom:1px solid #f3f4f6; font-size:13px;">
      <div>
        <div style="font-weight:600; color:#1B1F6B; margin-bottom:2px;">
          ${licon('file', 14)} ${log.filename || 'CSV File'}
        </div>
        <div style="color:#6b7280; font-size:12px;">${fmtDate(log.imported_at)}</div>
      </div>
      <div style="text-align:right;">
        <div style="color:#166534; font-weight:600;">+${log.imported_count} added</div>
        ${log.error_count > 0 ? `<div style="color:#991b1b; font-size:12px;">${log.error_count} skipped</div>` : ''}
      </div>
    </div>
  `).join('');
  lucide.createIcons();

  if (!pagEl) return;

  if (totalPages <= 1) {
    pagEl.style.display = 'none';
    return;
  }

  pagEl.style.display = 'flex';

  const btnStyle = (active) =>
    `style="min-width:28px; height:28px; padding:0 7px; border-radius:6px;
      border:1px solid ${active ? '#1B1F6B' : '#e5e7eb'};
      background:${active ? '#1B1F6B' : '#fff'};
      color:${active ? '#fff' : '#374151'};
      font-size:12px; font-weight:600; cursor:${active ? 'default' : 'pointer'};"`;

  const navBtn = (label, onclick, disabled) =>
    `<button onclick="${onclick}" ${disabled ? 'disabled' : ''}
      style="min-width:28px; height:28px; padding:0 7px; border-radius:6px;
        border:1px solid #e5e7eb; background:#fff;
        color:${disabled ? '#d1d5db' : '#374151'};
        font-size:12px; font-weight:700; cursor:${disabled ? 'default' : 'pointer'};">${label}</button>`;

  const end = Math.min(importHistoryPage * IMPORT_HISTORY_PAGE_SIZE, total);

  const pageButtons = [];
  for (let i = 1; i <= totalPages; i++) {
    const isActive = i === importHistoryPage;
    pageButtons.push(
      `<button onclick="goToImportHistoryPage(${i})" ${isActive ? 'disabled' : ''} ${btnStyle(isActive)}>${i}</button>`
    );
  }

  pagEl.innerHTML = `
    <span>${start + 1}–${end} of ${total} imports</span>
    <div style="display:flex; gap:4px; align-items:center;">
      ${navBtn('«', 'goToImportHistoryPage(1)', importHistoryPage === 1)}
      ${navBtn('‹', `goToImportHistoryPage(${importHistoryPage - 1})`, importHistoryPage === 1)}
      ${pageButtons.join('')}
      ${navBtn('›', `goToImportHistoryPage(${importHistoryPage + 1})`, importHistoryPage === totalPages)}
      ${navBtn('»', `goToImportHistoryPage(${totalPages})`, importHistoryPage === totalPages)}
    </div>
  `;
}

function goToImportHistoryPage(page) {
  const totalPages = Math.ceil(importHistoryAllLogs.length / IMPORT_HISTORY_PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  importHistoryPage = page;
  renderImportHistoryPage();
}
