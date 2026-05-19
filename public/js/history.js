// ── LOAD DELETION HISTORY ──
async function loadHistory() {
  try {
    const res     = await fetch('/api/deletion-history');
    const records = await res.json();
    const tbody   = document.getElementById('historyTable');

    if (!records.length) {
      tbody.innerHTML = emptyState(
        '🗂',
        'No deletion history yet',
        'Deleted records will appear here'
      );
      return;
    }

    tbody.innerHTML = records.map(r => `
      <tr>
        <td>
          <span class="badge ${r.record_type === 'SCHOOL'
            ? 'badge-new' : 'badge-default'}">
            ${r.record_type}
          </span>
        </td>
        <td>${r.record_name}</td>
        <td>${r.reason || '—'}</td>
        <td>${formatHistoryDate(r.deleted_at)}</td>
      </tr>
    `).join('');

  } catch (e) {
    showToast('Could not load deletion history', 'error');
  }
}

// ── FORMAT DATE ──
function formatHistoryDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month:   'short',
    day:     'numeric',
    year:    'numeric',
    hour:    '2-digit',
    minute:  '2-digit'
  });
}