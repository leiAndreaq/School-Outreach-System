// ── IMPORT CSV ──
async function importCSV(input) {
  const file = input.files[0];
  if (!file) return;

  // Show loading state
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

    // Success
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

    // Reset file input
    input.value = '';

    showToast('✅ Imported ' + data.imported + ' schools!', 'success');

    // Refresh dashboard in background
    loadDashboard();

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