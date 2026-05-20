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

    // Show email preview in modal — now editable!
    document.getElementById('emailModalBody').innerHTML = `
      <div class="email-subject">
        Subject: ${data.subject}
      </div>
      <div style="font-size:12px; color:#9ca3af; margin-bottom:8px;">
        ✏️ You can edit the email below before sending.
        Paste your Google Meet link where needed.
      </div>
      <textarea
        id="editableEmailBody"
        style="width:100%; min-height:320px; padding:14px;
          border:1.5px solid #e5e7eb; border-radius:8px;
          font-size:13px; line-height:1.8; color:#374151;
          font-family:'Inter',sans-serif; resize:vertical;
          outline:none;"
        onfocus="this.style.borderColor='#1B1F6B'"
        onblur="this.style.borderColor='#e5e7eb'"
      >${data.body}</textarea>
      <div id="meetLinkWarning" style="display:none; margin-top:8px;
        padding:10px 12px; background:#fef3c7; border-radius:6px;
        font-size:12px; color:#92400e;">
        ⚠️ No meeting link detected. Please paste your
        Google Meet or Zoom link in the email before sending.
      </div>
    `;

    // Show send button
    document.getElementById('emailModalActions').innerHTML = `
      <button
        onclick="saveAndSendDraft(${data.draft_id})"
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

    if (data.error) {
      showToast('SMTP Error: ' + data.error, 'error');
    } else if (data.sent) {
      showToast('✅ Email sent successfully!', 'success');
      closeModal('emailModal');
      loadDrafts();
      loadDashboard();
    } else {
      showToast('Not sent: ' + (data.reason || 'Unknown reason'), 'error');
    }

  } catch (e) {
    showToast('Error sending email', 'error');
  }
}

// ── DRAFT DATA CACHE (used by previewDraft to avoid inline JSON in onclick) ──
let draftsCache = {};

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

    draftsCache = {};
    drafts.forEach(d => { draftsCache[d.id] = d; });

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
            onclick="previewDraft(${d.id})"
            class="btn-ghost text-xs py-1 px-3">
            👁 View
          </button>
        </td>
      </tr>
    `).join('');

  } catch (e) {
    showToast('Could not load drafts', 'error');
  }
}

// ── PREVIEW DRAFT ──
function previewDraft(id) {
  const d = draftsCache[id];
  if (!d) { showToast('Could not load draft', 'error'); return; }
  document.getElementById('emailModalBody').innerHTML = `
    <div class="email-subject">Subject: ${d.subject}</div>
    <div style="margin-top:12px; padding:14px; background:#f9fafb;
      border:1.5px solid #e5e7eb; border-radius:8px;
      font-size:13px; line-height:1.8; color:#374151;
      font-family:'Inter',sans-serif; white-space:pre-wrap;">
      ${d.body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </div>
  `;

  document.getElementById('emailModalActions').innerHTML = `
    <button onclick="closeModal('emailModal')" class="btn-ghost text-sm">Close</button>
  `;

  openModal('emailModal');
}

// ── SAVE EDITS AND SEND ──
async function saveAndSendDraft(draftId) {
  const bodyEl = document.getElementById('editableEmailBody');
  if (!bodyEl) {
    sendDraft(draftId);
    return;
  }

  const editedBody = bodyEl.value;

  // ── CHECK FOR MEETING LINK (soft warning — does not block send) ──
  const hasLink =
    editedBody.includes('meet.google.com') ||
    editedBody.includes('zoom.us') ||
    editedBody.includes('https://') ||
    editedBody.includes('http://');

  if (!hasLink) {
    document.getElementById('meetLinkWarning').style.display = 'block';
  }

  // Save the edited body first
  try {
    await fetch('/api/email-drafts/' + draftId + '/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editedBody })
    });
  } catch (e) {
    console.error('Could not save edits, sending original');
  }

  // Then send
  sendDraft(draftId);
}

// ── CHECK MEET LINK AS USER TYPES ──
function checkMeetLink() {
  const bodyEl  = document.getElementById('editableEmailBody');
  const warning = document.getElementById('meetLinkWarning');
  if (!bodyEl || !warning) return;

  const hasLink =
    bodyEl.value.includes('meet.google.com') ||
    bodyEl.value.includes('zoom.us') ||
    bodyEl.value.includes('https://');

  warning.style.display = hasLink ? 'none' : 'block';
}