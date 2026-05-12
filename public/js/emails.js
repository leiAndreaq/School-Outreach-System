// ── GENERATE EMAIL ──
async function generateEmail(id, type) {
  closeModal('schoolModal');
  showToast('⚡ Generating ' + type + ' email...', '');

  try {
    const res = await fetch('/api/schools/' + id + '/generate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_type: type })
    });
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('✅ Email generated!', 'success');

    // Show email preview in modal
    document.getElementById('emailModalBody').innerHTML = `
      <div class="email-subject">
        Subject: ${data.subject}
      </div>
      <div class="email-preview">
        ${data.body}
      </div>
    `;

    // Show send button
    document.getElementById('emailModalActions').innerHTML = `
      <button
        onclick="sendDraft(${data.draft_id})"
        class="btn-navy text-sm">
        📤 Send Email
      </button>
    `;

    openModal('emailModal');

    // Refresh data in background
    loadDashboard();
    if (document.getElementById('tab-schools').classList.contains('active')) {
      loadSchools();
    }

  } catch (e) {
    showToast('Failed to generate email', 'error');
  }
}

// ── SEND DRAFT ──
async function sendDraft(draftId) {
  const confirmed = confirm(
    'Are you sure you want to send this email?\n\nMake sure it has been approved first.'
  );
  if (!confirmed) return;

  try {
    const res = await fetch('/api/email-drafts/' + draftId + '/send', {
      method: 'POST'
    });
    const data = await res.json();

    if (data.sent) {
      showToast('✅ Email sent successfully!', 'success');
      closeModal('emailModal');
      loadDrafts();
      loadDashboard();
    } else {
      showToast('📋 ' + (data.reason || 'Draft mode — email not sent yet'), '');
    }

  } catch (e) {
    showToast('Error sending email', 'error');
  }
}

// ── LOAD ALL DRAFTS ──
async function loadDrafts() {
  try {
    const res = await fetch('/api/email-drafts');
    const drafts = await res.json();
    const tbody = document.getElementById('draftsTable');

    if (!drafts.length) {
      tbody.innerHTML = emptyState(
        '✉️',
        'No drafts yet',
        'Generate an email from a school lead first'
      );
      return;
    }

    tbody.innerHTML = drafts.map(d => `
      <tr>
        <td>${d.school_name || '—'}</td>
        <td>
          <span class="badge badge-default">${d.email_type}</span>
        </td>
        <td style="max-width:260px; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap;">
          ${d.subject}
        </td>
        <td>${statusBadge(d.status)}</td>
        <td>${fmtDate(d.created_at)}</td>
        <td>
          <button
            onclick="previewDraft(${d.id}, ${JSON.stringify(d.subject)}, ${JSON.stringify(d.body)})"
            class="btn-ghost text-xs py-1 px-3">
            👁 Preview
          </button>
        </td>
      </tr>
    `).join('');

  } catch (e) {
    showToast('Could not load drafts', 'error');
  }
}

// ── PREVIEW DRAFT ──
function previewDraft(id, subject, body) {
  document.getElementById('emailModalBody').innerHTML = `
    <div class="email-subject">
      Subject: ${subject}
    </div>
    <div class="email-preview">
      ${body}
    </div>
  `;

  document.getElementById('emailModalActions').innerHTML = `
    <button
      onclick="sendDraft(${id})"
      class="btn-navy text-sm">
      📤 Send Email
    </button>
  `;

  openModal('emailModal');
}