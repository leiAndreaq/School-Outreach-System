// ── CALENDAR STATE ──
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed (0 = January)
let allMeetings  = [];
let currentMeetingId   = null;
let currentMeetingData = null;
let upcomingMode = 'weekly'; // cycles: 'weekly' → 'monthly' → 'today' → 'weekly'

// ── MONTH NAMES ──
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── LOAD CALENDAR TAB ──
async function loadCalendar() {
  await loadUpcoming();
  await renderCalendar(currentYear, currentMonth);
}

// ── SET UPCOMING MODE ──
function setUpcomingMode(mode) {
  upcomingMode = mode;

  const titleMap = {
    today:   'Today\'s Meetings',
    weekly:  'Upcoming This Week',
    monthly: 'Upcoming This Month',
  };

  const titleEl = document.getElementById('upcomingTitle');
  if (titleEl) titleEl.innerHTML =
    `<i data-lucide="map-pin" style="width:15px;height:15px;"></i> ${titleMap[mode]}`;

  ['today', 'weekly', 'monthly'].forEach(m => {
    const btn = document.getElementById('upcoming-btn-' + m);
    if (!btn) return;
    const active = m === mode;
    btn.style.background = active ? '#1B1F6B' : 'transparent';
    btn.style.color      = active ? '#fff'    : '#6b7280';
  });

  lucide.createIcons();
  loadUpcoming();
}

// ── LOAD UPCOMING MEETINGS ──
async function loadUpcoming() {
  const tbody = document.getElementById('upcomingTable');
  const emptyMessages = {
    today:   ['No meetings today',        'Enjoy your day — nothing scheduled'],
    weekly:  ['No meetings this week',    'Schedule a presentation to get started'],
    monthly: ['No meetings this month',   'Nothing scheduled for this month yet'],
  };

  try {
    let meetings = [];

    if (upcomingMode === 'today') {
      const res = await fetch('/api/meetings/today');
      meetings = await res.json();
    } else if (upcomingMode === 'weekly') {
      const res = await fetch('/api/meetings/upcoming/week');
      meetings = await res.json();
    } else {
      const y = currentYear;
      const m = currentMonth + 1;
      const res = await fetch(`/api/meetings/month/${y}/${m}`);
      meetings = await res.json();
    }

    if (!meetings.length) {
      const [title, sub] = emptyMessages[upcomingMode];
      tbody.innerHTML = emptyState('calendar', title, sub);
      lucide.createIcons();
      return;
    }

    tbody.innerHTML = meetings.map(m => `
      <tr>
        <td>${m.school_name}</td>
        <td>${m.contact_person || '—'}</td>
        <td>${formatDateDisplay(m.meeting_date)}</td>
        <td>${formatTime(m.meeting_time)}</td>
        <td>${modeBadge(m.meeting_mode)}</td>
        <td>${meetingStatusBadge(m.status)}</td>
        <td>
          <button
            onclick="viewMeeting(${m.id})"
            class="btn-ghost text-xs py-1 px-3" style="display:inline-flex;align-items:center;gap:4px;">
            ${licon('eye')} View
          </button>
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
  } catch (e) {
    showToast('Could not load upcoming meetings', 'error');
  }
}

// ── RENDER CALENDAR GRID ──
async function renderCalendar(year, month) {
  document.getElementById('calendarTitle').textContent =
    MONTHS[month] + ' ' + year;

  try {
    const res = await fetch(`/api/meetings/month/${year}/${month + 1}`);
    allMeetings = await res.json();
  } catch (e) {
    allMeetings = [];
  }

  const grid = document.getElementById('calendarGrid');
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  let html = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayMeetings = allMeetings.filter(m => m.meeting_date === dateStr);
    const isToday =
      today.getFullYear() === year &&
      today.getMonth()    === month &&
      today.getDate()     === day;

    html += `
      <div class="calendar-day ${isToday ? 'today' : ''}"
           onclick="onDayClick('${dateStr}')">
        <div class="day-number ${isToday ? 'today-number' : ''}">${day}</div>
        ${dayMeetings.map(m => `
          <div class="meeting-dot ${m.status === 'CANCELLED' ? 'cancelled' :
            m.status === 'RESCHEDULED' ? 'rescheduled' :
            m.status === 'DONE' ? 'done' : ''}"
            onclick="event.stopPropagation(); viewMeeting(${m.id})">
            <span>${formatTime(m.meeting_time)}</span>
            <span>${truncate(m.school_name, 12)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  grid.innerHTML = html;
}

// ── NAVIGATE MONTHS ──
function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar(currentYear, currentMonth);
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar(currentYear, currentMonth);
}

function goToToday() {
  currentYear  = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  renderCalendar(currentYear, currentMonth);
}

// ── CLICK ON A DAY ──
function onDayClick(dateStr) {
  // Pre-fill the date in the schedule modal
  document.getElementById('m-meeting_date').value = dateStr;
  openScheduleModal();
}

// ── SCHOOL PICKER STATE ──
let _schoolPickerData = [];

// ── OPEN SCHEDULE MODAL ──
async function openScheduleModal() {
  // Reset picker and errors
  document.getElementById('schoolSearch').value = '';
  document.getElementById('m-school_id').value  = '';
  document.getElementById('schoolDropdownList').style.display = 'none';
  clearScheduleError();

  try {
    const res = await fetch('/api/schools?mode=school&lead_type=OFFICIAL');
    _schoolPickerData = await res.json();
  } catch (e) {
    showToast('Could not load schools', 'error');
  }

  openModal('scheduleModal');
  lucide.createIcons();
}

// ── RENDER SCHOOL DROPDOWN ──
function renderSchoolDropdown(schools) {
  const list = document.getElementById('schoolDropdownList');
  if (!schools.length) {
    list.innerHTML = '<div style="padding:12px 16px;font-size:13px;color:#9ca3af;">No schools found</div>';
    return;
  }

  list.innerHTML = schools.map(s => {
    const hasMeeting = !!s.active_meeting_date;
    const meetingInfo = hasMeeting
      ? `<span style="font-size:11px;color:#1e40af;white-space:nowrap;flex-shrink:0;">
           📅 ${fmtDate(s.active_meeting_date)} ${formatTimeShort(s.active_meeting_time)}
         </span>`
      : '';

    return `<div
      onclick="${hasMeeting ? '' : `pickSchool(${s.id}, \`${s.school_name.replace(/`/g, "'")}\`)`}"
      style="display:flex;align-items:center;justify-content:space-between;gap:12px;
             padding:10px 16px;cursor:${hasMeeting ? 'not-allowed' : 'pointer'};
             opacity:${hasMeeting ? '0.45' : '1'};
             border-bottom:1px solid #f3f4f6;
             transition:background 0.1s;"
      onmouseenter="if(!${hasMeeting}) this.style.background='#f0f4ff'"
      onmouseleave="this.style.background=''"
    >
      <div style="min-width:0;">
        <div style="font-size:13px;font-weight:600;color:#1B1F6B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${s.school_name}
        </div>
        <div style="font-size:11px;color:#9ca3af;">${s.city_province || ''}</div>
      </div>
      ${meetingInfo}
    </div>`;
  }).join('');
}

// ── SHOW DROPDOWN ──
function showSchoolDropdown() {
  renderSchoolDropdown(_schoolPickerData);
  document.getElementById('schoolDropdownList').style.display = 'block';
}

// ── FILTER DROPDOWN BY SEARCH ──
function filterSchoolDropdown() {
  const q = document.getElementById('schoolSearch').value.toLowerCase();
  // Clear selected value if user is typing again
  document.getElementById('m-school_id').value = '';
  const filtered = _schoolPickerData.filter(s =>
    s.school_name.toLowerCase().includes(q) ||
    (s.city_province || '').toLowerCase().includes(q)
  );
  renderSchoolDropdown(filtered);
  document.getElementById('schoolDropdownList').style.display = 'block';
}

// ── SELECT A SCHOOL ──
function pickSchool(id, name) {
  document.getElementById('m-school_id').value  = id;
  document.getElementById('schoolSearch').value = name;
  document.getElementById('schoolDropdownList').style.display = 'none';
  clearScheduleError();
}

// ── CLOSE DROPDOWN WHEN CLICKING OUTSIDE ──
document.addEventListener('click', function(e) {
  const wrapper = document.getElementById('schoolPickerWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const list = document.getElementById('schoolDropdownList');
    if (list) list.style.display = 'none';
  }
});

// ── TOGGLE MEETING MODE (show/hide link or address) ──
function toggleMeetingMode() {
  const mode = document.getElementById('m-meeting_mode').value;
  const linkGroup    = document.getElementById('meetingLinkGroup');
  const addressGroup = document.getElementById('meetingAddressGroup');

  if (mode === 'ONLINE') {
    linkGroup.style.display    = 'block';
    addressGroup.style.display = 'none';
  } else if (mode === 'ONSITE') {
    linkGroup.style.display    = 'none';
    addressGroup.style.display = 'block';
  } else {
    // HYBRID — show both
    linkGroup.style.display    = 'block';
    addressGroup.style.display = 'block';
  }
}

// ── SCHEDULE MEETING ──
async function scheduleMeeting() {
  const schoolId = document.getElementById('m-school_id').value;
  const date     = document.getElementById('m-meeting_date').value;
  const time     = document.getElementById('m-meeting_time').value;
  const mode     = document.getElementById('m-meeting_mode').value;

  if (!schoolId || !date || !time) {
    showToast('Please fill in School, Date, and Time', 'error');
    return;
  }

  // 2-hour advance rule for same-day scheduling
  const phtNow   = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const todayPHT = phtNow.toISOString().split('T')[0];
  if (date === todayPHT) {
    const nowMins     = phtNow.getUTCHours() * 60 + phtNow.getUTCMinutes();
    const [th, tm]    = time.split(':').map(Number);
    const meetingMins = th * 60 + tm;
    if (meetingMins < nowMins + 120) {
      const earliest = new Date(phtNow.getTime() + 2 * 60 * 60 * 1000);
      const eh = String(earliest.getUTCHours()).padStart(2, '0');
      const em = String(earliest.getUTCMinutes()).padStart(2, '0');
      showToast(`Same-day meetings must be at least 2 hours from now. Earliest available: ${formatTimeShort(eh + ':' + em)}`, 'error');
      return;
    }
  }

  const payload = {
    school_id:       schoolId,
    meeting_date:    date,
    meeting_time:    time,
    meeting_type:    document.getElementById('m-meeting_type').value,
    meeting_mode:    mode,
    meeting_link:    document.getElementById('m-meeting_link').value,
    meeting_address: document.getElementById('m-meeting_address').value,
    notes:           document.getElementById('m-notes').value,
  };

  try {
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.error) {
      // ── Show specific error messages based on conflict type ──
      handleSchedulingError(data);
      return;
    }

    showToast('Meeting scheduled!', 'success');
    closeModal('scheduleModal');
    clearScheduleForm();
    loadCalendar();
    loadDashboard();

  } catch (e) {
    showToast('Failed to schedule meeting', 'error');
  }
}

// ── HANDLE SCHEDULING ERRORS ──
function handleSchedulingError(data) {
  const type = data.conflict_type;

  if (type === 'SCHOOL_ALREADY_HAS_MEETING') {
    showConflictAlert(
      'School Already Has a Meeting',
      data.error,
      'Please go to the Calendar and cancel or reschedule the existing meeting first.'
    );
  } else if (type === 'MAX_MEETINGS_REACHED') {
    showConflictAlert(
      'Maximum Meetings Reached',
      data.error,
      'Only 3 meetings are allowed per day. Please choose a different date.'
    );
  } else if (type === 'TIME_SLOT_TAKEN') {
    showConflictAlert(
      'Time Slot Conflict',
      data.error,
      'Please choose a time at least 30 minutes away from existing meetings.'
    );
  } else if (type === 'OUTSIDE_METRO_MANILA') {
    showConflictAlert(
      'Outside Metro Manila',
      data.error,
      'Switch to Online mode or contact your partner for areas outside Metro Manila.'
    );
  } else if (type === 'TOO_SOON') {
    showConflictAlert(
      'Too Soon to Schedule',
      data.error,
      'Same-day meetings need at least 2 hours of preparation time.'
    );
  } else {
    showToast('Error: ' + data.error, 'error');
  }
}

// ── SHOW INLINE SCHEDULE ERROR ──
function showConflictAlert(title, message, suggestion) {
  const box = document.getElementById('scheduleInlineError');
  if (!box) { showToast(message, 'error'); return; }
  box.innerHTML = `<strong>${title}</strong><br>${message}${suggestion ? `<br><span style="color:#b91c1c;font-size:12px;">${suggestion}</span>` : ''}`;
  box.style.display = 'block';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── CLEAR INLINE SCHEDULE ERROR ──
function clearScheduleError() {
  const box = document.getElementById('scheduleInlineError');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}

// ── CHECK DATE WHEN ADMIN PICKS IT ──
async function checkDateAvailability(date) {
  if (!date) return;
  clearScheduleError();

  // If today: enforce 2-hour minimum, update time input's min attribute
  const phtNow    = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const todayPHT  = phtNow.toISOString().split('T')[0];
  const timeInput = document.getElementById('m-meeting_time');
  if (date === todayPHT) {
    const earliest = new Date(phtNow.getTime() + 2 * 60 * 60 * 1000);
    const eh = String(earliest.getUTCHours()).padStart(2, '0');
    const em = String(earliest.getUTCMinutes()).padStart(2, '0');
    if (timeInput) {
      timeInput.min = `${eh}:${em}`;
      // Clear any currently selected time that is now too early
      if (timeInput.value && timeInput.value < `${eh}:${em}`) timeInput.value = '';
    }
  } else {
    if (timeInput) timeInput.removeAttribute('min');
  }

  try {
    const res  = await fetch('/api/meetings/check/' + date);
    const data = await res.json();

    const indicator = document.getElementById('dateAvailability');
    if (!indicator) return;

    if (data.is_full) {
      indicator.innerHTML = `
        <div style="color:#991b1b; font-size:12px; margin-top:6px;
          padding:8px 12px; background:#fee2e2; border-radius:6px;">
          ${licon('x-circle', 13)} This date is fully booked (3/3 meetings). Please choose another date.
        </div>
      `;
    } else if (data.count === 0) {
      indicator.innerHTML = `
        <div style="color:#166534; font-size:12px; margin-top:6px;
          padding:8px 12px; background:#dcfce7; border-radius:6px;">
          ${licon('check-circle', 13)} This date is available (0/3 meetings scheduled)
        </div>
      `;
    } else {
      const remaining = 3 - data.count;
      const times = data.meetings.map(m =>
        formatTime(m.meeting_time) + ' — ' + m.school_name
      ).join(', ');
      indicator.innerHTML = `
        <div style="color:#92400e; font-size:12px; margin-top:6px;
          padding:8px 12px; background:#fef3c7; border-radius:6px;">
          ${licon('alert-triangle', 13)} ${data.count}/3 meetings on this date.
          ${remaining} slot${remaining > 1 ? 's' : ''} remaining.<br/>
          <span style="color:#6b7280;">
            Existing: ${times}
          </span>
        </div>
      `;
    }
    lucide.createIcons();
  } catch (e) {
    console.error('Could not check date availability');
  }
}

// ── VIEW MEETING ──
async function viewMeeting(id) {
  try {
    const res = await fetch('/api/meetings/' + id);
    const m = await res.json();
    currentMeetingId   = id;
    currentMeetingData = m;

    const isCancelled   = m.status === 'CANCELLED';
    const isRescheduled = m.status === 'RESCHEDULED';
    const isDone        = m.status === 'DONE';

    document.getElementById('meetingModalBody').innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 24px;">
        ${detailRow('School',   m.school_name)}
        ${detailRow('Contact',  m.contact_person)}
        ${detailRow('Date',     formatDateDisplay(m.meeting_date))}
        ${detailRow('Time',     formatTime(m.meeting_time))}
        ${detailRow('Type',     m.meeting_type)}
        ${detailRow('Mode',     m.meeting_mode)}
        ${detailRow('Status',   meetingStatusBadge(m.status))}
      </div>
      <div style="display:grid; grid-template-columns:1fr; gap:6px 24px;">
        ${m.meeting_link ?
          detailRow('Meeting Link',
            `<a href="${m.meeting_link}" target="_blank"
              style="color:var(--navy)">${m.meeting_link}</a>`) : ''}
        ${m.meeting_address ?
          detailRow('Address', m.meeting_address) : ''}
        ${m.school_email ? detailRow('Email', `<a href="mailto:${m.school_email}" style="color:var(--navy)">${m.school_email}</a>`) : ''}
      </div>
      ${m.notes ? `
        <div style="margin-top:16px; padding:12px; background:#f9fafb;
          border-radius:8px; font-size:13px; color:#4b5563;">
          ${licon('file-text', 14)} ${m.notes}
        </div>` : ''}
      ${isCancelled ? `
        <div style="margin-top:16px; padding:12px; background:#fee2e2;
          border-radius:8px; font-size:13px; color:#991b1b;">
          ${licon('alert-triangle', 14)} This meeting was cancelled.
        </div>` : ''}
      ${isRescheduled ? `
        <div style="margin-top:16px; padding:12px; background:#fef3c7;
          border-radius:8px; font-size:13px; color:#92400e;">
          ${licon('refresh-cw', 14)} This meeting has been rescheduled.
        </div>` : ''}
    `;

    // Show different action buttons based on status
    const footer = document.getElementById('meetingModalFooter');

    if (isCancelled) {
      footer.innerHTML = `
        <button onclick="closeModal('meetingModal')" class="btn-ghost">
          Close
        </button>
      `;
    } else if (isDone) {
      footer.innerHTML = `
        <button onclick="closeModal('meetingModal')" class="btn-ghost">
          Close
        </button>
      `;
    } else {
      footer.innerHTML = `
        <button onclick="closeModal('meetingModal')" class="btn-ghost">
          Close
        </button>
        <button onclick="openRescheduleModal()" class="btn-outline text-sm" style="display:inline-flex;align-items:center;gap:5px;">
          ${licon('refresh-cw')} Reschedule
        </button>
        <button onclick="markAsDone()" class="btn-navy text-sm" style="display:inline-flex;align-items:center;gap:5px;">
          ${licon('check-circle')} Mark as Done
        </button>
        <button onclick="openCancelModal()" class="btn-ghost text-sm"
          style="color:#991b1b;display:inline-flex;align-items:center;gap:5px;">
          ${licon('trash-2')} Cancel Meeting
        </button>
      `;
    }

    openModal('meetingModal');
    lucide.createIcons();
  } catch (e) {
    showToast('Could not load meeting details', 'error');
  }
}
// ── GENERATE POST-MEETING FOLLOW-UP EMAIL ──
async function generateFollowUpEmail() {
  if (!currentMeetingId) return;
  closeModal('meetingModal');
  showToast('Generating follow-up email...', '');

  try {
    const res = await fetch('/api/meetings/' + currentMeetingId + '/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('Follow-up email ready!', 'success');

    document.getElementById('emailModalBody').innerHTML = `
      <div class="email-subject">Subject: ${data.subject}</div>
      <div style="font-size:12px; color:#9ca3af; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
        ${licon('pencil', 12)} You can edit the email below before sending.
      </div>
      <textarea
        id="editableEmailBody"
        style="width:100%; min-height:320px; padding:14px;
          border:1.5px solid #e5e7eb; border-radius:8px;
          font-size:13px; line-height:1.8; color:#374151;
          font-family:'Inter',sans-serif; resize:vertical; outline:none;"
        onfocus="this.style.borderColor='#1B1F6B'"
        onblur="this.style.borderColor='#e5e7eb'"
      >${data.body}</textarea>
    `;

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

    loadDrafts();
  } catch (e) {
    showToast('Failed to generate follow-up email', 'error');
  }
}

// ── MARK MEETING AS DONE ──
async function markAsDone() {
  if (!currentMeetingId) return;
  try {
    await fetch('/api/meetings/' + currentMeetingId + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' })
    });
    showToast('Meeting marked as done!', 'success');
    closeModal('meetingModal');
    loadCalendar();
    loadDashboard();
  } catch (e) {
    showToast('Failed to update meeting', 'error');
  }
}

// ── CANCEL MEETING ──
// ── OPEN CANCEL MODAL ──
function openCancelModal() {
  document.getElementById('cancelReason').value = '';
  closeModal('meetingModal');
  openModal('cancelModal');
}

// ── CONFIRM CANCEL MEETING ──
async function confirmCancelMeeting() {
  if (!currentMeetingId) return;
  const reason = document.getElementById('cancelReason').value.trim();

  try {
    const res = await fetch('/api/meetings/' + currentMeetingId + '/cancel', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('Meeting cancelled', '');
    closeModal('cancelModal');
    loadCalendar();
    loadDashboard();
  } catch (e) {
    showToast('Failed to cancel meeting', 'error');
  }
}

// ── OPEN RESCHEDULE MODAL ──
function openRescheduleModal() {
  const m = currentMeetingData;
  document.getElementById('r-meeting_date').value = m ? m.meeting_date : '';
  document.getElementById('r-meeting_time').value = m ? m.meeting_time : '';
  document.getElementById('r-notes').value        = m ? (m.notes || '') : '';
  const indicator = document.getElementById('reschedDateAvailability');
  if (indicator) indicator.innerHTML = '';
  closeModal('meetingModal');
  openModal('rescheduleModal');
}

async function checkReschedDateAvailability(date) {
  if (!date) return;
  const indicator = document.getElementById('reschedDateAvailability');
  if (!indicator) return;
  try {
    const res  = await fetch('/api/meetings/check/' + date);
    const data = await res.json();
    if (data.is_full) {
      indicator.innerHTML = `
        <div style="color:#991b1b; font-size:12px; margin-top:6px;
          padding:8px 12px; background:#fee2e2; border-radius:6px;">
          ${licon('x-circle', 13)} This date is fully booked (3/3 meetings). Please choose another date.
        </div>`;
    } else if (data.count === 0) {
      indicator.innerHTML = `
        <div style="color:#166534; font-size:12px; margin-top:6px;
          padding:8px 12px; background:#dcfce7; border-radius:6px;">
          ${licon('check-circle', 13)} This date is available (0/3 meetings scheduled)
        </div>`;
    } else {
      const remaining = 3 - data.count;
      indicator.innerHTML = `
        <div style="color:#92400e; font-size:12px; margin-top:6px;
          padding:8px 12px; background:#fef3c7; border-radius:6px;">
          ${licon('alert-triangle', 13)} ${data.count}/3 meetings on this date. ${remaining} slot${remaining > 1 ? 's' : ''} remaining.
        </div>`;
    }
    lucide.createIcons();
  } catch (e) {
    console.error('Could not check date availability');
  }
}

// ── CONFIRM RESCHEDULE ──
async function confirmReschedule() {
  if (!currentMeetingId) return;

  const date  = document.getElementById('r-meeting_date').value;
  const time  = document.getElementById('r-meeting_time').value;
  const notes = document.getElementById('r-notes').value;

  if (!date || !time) {
    showToast('Please fill in the new date and time', 'error');
    return;
  }

  try {
    const res = await fetch('/api/meetings/' + currentMeetingId + '/reschedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meeting_date: date, meeting_time: time, notes })
    });
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      return;
    }

    showToast('Meeting rescheduled!', 'success');
    closeModal('rescheduleModal');
    loadCalendar();
    loadDashboard();
  } catch (e) {
    showToast('Failed to reschedule meeting', 'error');
  }
}

// ── CLEAR SCHEDULE FORM ──
function clearScheduleForm() {
  ['m-school_id','m-meeting_date','m-meeting_time',
   'm-meeting_type','m-meeting_link',
   'm-meeting_address','m-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const modeEl = document.getElementById('m-meeting_mode');
  if (modeEl) modeEl.value = 'ONLINE';
  const indicator = document.getElementById('dateAvailability');
  if (indicator) indicator.innerHTML = '';
  toggleMeetingMode();
}

// ── HELPERS ──

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    year:    'numeric'
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '…' : str;
}

function modeBadge(mode) {
  const map = {
    'ONLINE':  'background:#dbeafe; color:#1e40af;',
    'ONSITE':  'background:#dcfce7; color:#166534;',
    'HYBRID':  'background:#fef3c7; color:#92400e;',
  };
  const style = map[mode] || 'background:#f3f4f6; color:#374151;';
  return `<span class="badge" style="${style}">${mode || '—'}</span>`;
}

function meetingStatusBadge(status) {
  const map = {
    'SCHEDULED': 'background:#dbeafe; color:#1e40af;',
    'DONE':      'background:#dcfce7; color:#166534;',
    'CANCELLED': 'background:#fee2e2; color:#991b1b;',
  };
  const style = map[status] || 'background:#f3f4f6; color:#374151;';
  return `<span class="badge" style="${style}">${status || '—'}</span>`;
}