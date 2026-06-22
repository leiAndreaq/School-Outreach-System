// ── STATE ──
let pendingImportRows     = [];
let pendingImportFilename = '';
let pendingSchoolIds      = [];

// ── DOWNLOAD CSV TEMPLATE ──
function downloadCSVTemplate() {
  const header = 'school_name,contact_person,email,phone,website,facebook_page,address,city_province,region,school_type,level_offered,estimated_students,assigned_to,notes';
  const blob = new Blob([header + '\n'], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'school-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Template downloaded', 'success');
}

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
      body:    JSON.stringify({ rows: pendingImportRows, filename: pendingImportFilename, mode: window.currentMode || 'school' })
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

  // Load live HTML template preview
  const previewEl = document.getElementById('bulkEmailPreview');
  previewEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:12px;">Loading preview…</div>';
  fetch('/api/promo-preview')
    .then(r => r.text())
    .then(html => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
      iframe.setAttribute('sandbox', 'allow-same-origin');
      iframe.srcdoc = html;
      previewEl.innerHTML = '';
      previewEl.appendChild(iframe);
    })
    .catch(() => {
      previewEl.innerHTML = '<div style="padding:14px;font-size:12px;color:#6b7280;">Preview unavailable.</div>';
    });

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

    const errorList = data.errors && data.errors.length
      ? `<ul style="margin:8px 0 0 0; padding-left:16px; font-size:12px; line-height:1.8;">
          ${data.errors.map(e => `<li>${e}</li>`).join('')}
        </ul>`
      : '';

    if (data.sent > 0) {
      resultEl.innerHTML = `
        <div style="padding:12px 14px; background:#dcfce7; border-radius:8px; font-size:13px; color:#166534;">
          ${licon('check-circle', 14)} <strong>${data.sent} email(s) sent successfully!</strong>
          ${data.failed > 0 ? `
            <div style="margin-top:8px; padding:10px 12px; background:#fee2e2; border-radius:6px; color:#991b1b;">
              ${licon('alert-triangle', 13)} <strong>${data.failed} failed to send:</strong>
              ${errorList}
            </div>` : ''}
        </div>`;
      showToast(data.sent + ' promotional email(s) sent!', 'success');
    } else {
      resultEl.innerHTML = `
        <div style="padding:12px 14px; background:#fee2e2; border-radius:8px; font-size:13px; color:#991b1b;">
          ${licon('alert-triangle', 14)} <strong>No emails were sent.</strong>
          ${errorList}
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
// page size is dynamic — see calcPageSize() in app.js
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

  const pageSize   = calcPageSize(54, 310);
  const total      = logs.length;
  const totalPages = Math.ceil(total / pageSize);
  if (importHistoryPage > totalPages) importHistoryPage = totalPages;

  const start = (importHistoryPage - 1) * pageSize;
  const page  = logs.slice(start, start + pageSize);

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

  const end = Math.min(importHistoryPage * calcPageSize(54, 310), total);

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
  const totalPages = Math.ceil(importHistoryAllLogs.length / calcPageSize(54, 310));
  if (page < 1 || page > totalPages) return;
  importHistoryPage = page;
  renderImportHistoryPage();
}
