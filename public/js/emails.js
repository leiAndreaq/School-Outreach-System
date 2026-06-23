// ── DRAFT STATUS BADGE ──
function draftStatusBadge(status) {
  if (status === 'SENT')   return '<span class="badge badge-sent">SENT</span>';
  if (status === 'FAILED') return '<span class="badge" style="background:#fee2e2;color:#991b1b;">FAILED</span>';
  return '<span class="badge badge-default">DRAFT</span>';
}

// ── DRAFTS PAGINATION STATE ──
// page size is dynamic — see calcPageSize() in app.js
let draftsCurrentPage  = 1;
let draftsAllList      = [];

// ── GENERATE EMAIL ──
async function generateEmail(id, type) {
  closeModal('schoolModal');
  showToast('Generating ' + type + ' email...', '');

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

    showToast('Email generated!', 'success');

    // Show email preview in modal — now editable!
    document.getElementById('emailModalBody').innerHTML = `
      <div class="email-subject">
        Subject: ${data.subject}
      </div>
      <div style="font-size:12px; color:#9ca3af; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
        ${licon('pencil', 12)} You can edit the email below before sending. Paste your Google Meet link where needed.
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
        ${licon('alert-triangle', 13)} No meeting link detected. Please paste your
        Google Meet or Zoom link in the email before sending.
      </div>
    `;

    // Show send button — disabled for 5 seconds so user reviews the email first
    document.getElementById('emailModalActions').innerHTML = `
      <button
        id="sendEmailBtn"
        onclick="saveAndSendDraft(${data.draft_id})"
        class="btn-navy text-sm" disabled
        style="display:inline-flex;align-items:center;gap:6px;opacity:0.5;cursor:not-allowed;">
        ${licon('send', 14)} Send Email <span id="sendEmailCountdown" style="font-size:11px;margin-left:2px;">(5s)</span>
      </button>
    `;

    openModal('emailModal');
    lucide.createIcons();

    // Countdown to enable send button
    let secondsLeft = 5;
    const countdownInterval = setInterval(() => {
      secondsLeft--;
      const countdownEl = document.getElementById('sendEmailCountdown');
      if (countdownEl) countdownEl.textContent = '(' + secondsLeft + 's)';

      if (secondsLeft <= 0) {
        clearInterval(countdownInterval);
        const btn = document.getElementById('sendEmailBtn');
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
          const cd = document.getElementById('sendEmailCountdown');
          if (cd) cd.remove();
        }
      }
    }, 1000);

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
  const ok = await showConfirmModal(
    '<i data-lucide="send" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:5px;"></i> Send Email',
    'Are you sure you want to send this email?<br><br>Make sure it has been <strong>approved</strong> before sending.',
    'Send Email',
    'btn-navy'
  );
  if (!ok) {
    openModal('emailModal');
    return;
  }

  try {
    const res = await fetch('/api/email-drafts/' + draftId + '/send', {
      method: 'POST'
    });
    const data = await res.json();

    if (data.error) {
      showToast('SMTP Error: ' + data.error, 'error');
    } else if (data.sent) {
      showToast('Email sent successfully!', 'success');
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

    draftsCache = {};
    drafts.forEach(d => { draftsCache[d.id] = d; });

    draftsAllList    = drafts;
    draftsCurrentPage = 1;
    renderDrafts();

  } catch (e) {
    showToast('Could not load drafts', 'error');
  }
}

// ── RENDER DRAFTS PAGE ──
function renderDrafts() {
  const tbody = document.getElementById('draftsTable');
  const total = draftsAllList.length;

  if (!total) {
    tbody.innerHTML = emptyState(
      'mail',
      'No drafts yet',
      'Generate an email from a school lead first'
    );
    const pg = document.getElementById('draftsPagination');
    if (pg) pg.style.display = 'none';
    lucide.createIcons();
    return;
  }

  const pageSize   = calcPageSize(54, 310);
  const totalPages = Math.ceil(total / pageSize);
  if (draftsCurrentPage > totalPages) draftsCurrentPage = totalPages;

  const start = (draftsCurrentPage - 1) * pageSize;
  const page  = draftsAllList.slice(start, start + pageSize);

  tbody.innerHTML = page.map(d => `
    <tr>
      <td>${d.school_name || '—'}</td>
      <td>
        <span class="badge badge-default">${d.email_type}</span>
      </td>
      <td style="max-width:260px; overflow:hidden;
        text-overflow:ellipsis; white-space:nowrap;">
        ${d.subject}
      </td>
      <td>${draftStatusBadge(d.status)}</td>
      <td>${fmtDate(d.created_at)}</td>
      <td>
        <button
          onclick="previewDraft(${d.id})"
          class="btn-ghost text-xs py-1 px-3" style="display:inline-flex;align-items:center;gap:4px;">
          ${licon('eye')} View
        </button>
      </td>
    </tr>
  `).join('');
  lucide.createIcons();

  renderDraftsPagination(total, totalPages);
}

// ── RENDER DRAFTS PAGINATION ──
function renderDraftsPagination(total, totalPages) {
  const pg = document.getElementById('draftsPagination');
  if (!pg) return;

  if (totalPages <= 1) {
    pg.style.display = 'none';
    return;
  }

  pg.style.display = 'flex';

  const MAX_VISIBLE = 5;
  let winStart = Math.max(1, draftsCurrentPage - Math.floor(MAX_VISIBLE / 2));
  let winEnd   = winStart + MAX_VISIBLE - 1;
  if (winEnd > totalPages) {
    winEnd   = totalPages;
    winStart = Math.max(1, winEnd - MAX_VISIBLE + 1);
  }

  const btnStyle = (active) =>
    `style="min-width:30px; height:30px; padding:0 8px; border-radius:6px; border:1px solid ${active ? '#1B1F6B' : '#e5e7eb'}; background:${active ? '#1B1F6B' : '#fff'}; color:${active ? '#fff' : '#374151'}; font-size:12px; font-weight:600; cursor:${active ? 'default' : 'pointer'};"`;

  const navBtn = (label, onclick, disabled) =>
    `<button onclick="${onclick}" ${disabled ? 'disabled' : ''} style="min-width:30px; height:30px; padding:0 8px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; color:${disabled ? '#d1d5db' : '#374151'}; font-size:12px; font-weight:700; cursor:${disabled ? 'default' : 'pointer'};">${label}</button>`;

  const pageButtons = [];
  for (let i = winStart; i <= winEnd; i++) {
    const isActive = i === draftsCurrentPage;
    pageButtons.push(
      `<button onclick="goToDraftsPage(${i})" ${isActive ? 'disabled' : ''} ${btnStyle(isActive)}>${i}</button>`
    );
  }

  const pageSize = calcPageSize(54, 310);
  const start = (draftsCurrentPage - 1) * pageSize + 1;
  const end   = Math.min(draftsCurrentPage * pageSize, total);

  pg.innerHTML = `
    <div style="display:flex; gap:4px; align-items:center;">
      ${navBtn('«', 'goToDraftsPage(1)', draftsCurrentPage === 1)}
      ${navBtn('‹', `goToDraftsPage(${draftsCurrentPage - 1})`, draftsCurrentPage === 1)}
      ${pageButtons.join('')}
      ${navBtn('›', `goToDraftsPage(${draftsCurrentPage + 1})`, draftsCurrentPage === totalPages)}
      ${navBtn('»', `goToDraftsPage(${totalPages})`, draftsCurrentPage === totalPages)}
    </div>
    <span>${start}–${end} of ${total} drafts</span>
  `;
}

// ── GO TO DRAFTS PAGE ──
function goToDraftsPage(page) {
  const totalPages = Math.ceil(draftsAllList.length / calcPageSize(54, 310));
  if (page < 1 || page > totalPages) return;
  draftsCurrentPage = page;
  renderDrafts();
}

// ── PREVIEW DRAFT ──
function previewDraft(id) {
  const d = draftsCache[id];
  if (!d) { showToast('Could not load draft', 'error'); return; }

  // Decode HTML entities from server-side .escape() (e.g. &#x27; → ')
  const decodeEntities = (str) => {
    const tmp = document.createElement('textarea');
    tmp.innerHTML = str;
    return tmp.value;
  };

  document.getElementById('emailModalBody').innerHTML = `
    <div class="email-subject">Subject: ${d.subject}</div>
    <textarea id="draftPreviewBody" readonly
      style="width:100%; min-height:320px; padding:14px; margin-top:12px;
        background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:8px;
        font-size:13px; line-height:1.8; color:#374151;
        font-family:'Inter',sans-serif; resize:none; outline:none; cursor:default;"
    ></textarea>
  `;

  document.getElementById('draftPreviewBody').value = decodeEntities(d.body);
  document.getElementById('emailModalActions').innerHTML = '';
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

  const warningEl = document.getElementById('meetLinkWarning');
  if (warningEl && !hasLink) {
    warningEl.style.display = 'block';
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