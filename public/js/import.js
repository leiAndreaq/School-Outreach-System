// ── IMPORT CSV ──
async function importCSV(input) {
  const file = input.files[0];
  if (!file) return;

  document.getElementById('importResult').innerHTML = `
    <div style="color:#9ca3af; font-size:13px;">
      ⏳ Importing schools please wait...
    </div>
  `;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/import-csv', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    document.getElementById('importResult').innerHTML = `
      <div style="padding:16px; border-radius:8px;
        background:#dcfce7; border:1px solid #86efac;">
        <div style="font-weight:600; color:#166534; font-size:14px;">
          ✅ Import Complete
        </div>
        <div style="color:#166534; font-size:13px; margin-top:4px;">
          Successfully imported <strong>${data.imported}</strong> school(s).
        </div>
        ${data.errors.length ? `
          <div style="color:#991b1b; font-size:12px; margin-top:6px;">
            ⚠️ ${data.errors.length} row(s) had errors and were skipped.
          </div>` : ''}
      </div>
    `;

    input.value = '';
    showToast('✅ Imported ' + data.imported + ' schools!', 'success');
    loadDashboard();
    loadImportHistory();

  } catch (e) {
    document.getElementById('importResult').innerHTML = `
      <div style="padding:16px; border-radius:8px;
        background:#fee2e2; border:1px solid #fca5a5;">
        <div style="font-weight:600; color:#991b1b; font-size:14px;">
          ❌ Import Failed
        </div>
        <div style="color:#991b1b; font-size:13px; margin-top:4px;">
          Please check your CSV format and try again.
        </div>
      </div>
    `;
    showToast('Import failed', 'error');
  }
}

// ── IMPORT HISTORY ──
async function loadImportHistory() {
  const container = document.getElementById('importHistoryList');
  if (!container) return;

  try {
    const res = await fetch('/api/import-logs');
    const logs = await res.json();

    if (!logs.length) {
      container.innerHTML = `
        <div style="color:#9ca3af; font-size:13px; text-align:center; padding:32px 0;">
          No imports yet
        </div>`;
      return;
    }

    container.innerHTML = logs.map(log => `
      <div style="display:flex; align-items:center; justify-content:space-between;
        padding:10px 0; border-bottom:1px solid #f3f4f6; font-size:13px;">
        <div>
          <div style="font-weight:600; color:#1B1F6B; margin-bottom:2px;">
            📄 ${log.filename || 'CSV File'}
          </div>
          <div style="color:#6b7280; font-size:12px;">
            ${fmtDate(log.imported_at)}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="color:#166534; font-weight:600;">
            +${log.imported_count} added
          </div>
          ${log.error_count > 0 ? `
            <div style="color:#991b1b; font-size:12px;">
              ${log.error_count} skipped
            </div>` : ''}
        </div>
      </div>
    `).join('');

  } catch (e) {
    container.innerHTML = `
      <div style="color:#9ca3af; font-size:13px; text-align:center; padding:32px 0;">
        Could not load history
      </div>`;
  }
}
