// ── CALENDAR STATE ──
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed (0 = January)
let allMeetings  = [];
let currentMeetingId = null;

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

// ── LOAD UPCOMING MEETINGS THIS WEEK ──
async function loadUpcoming() {
  try {
    const res = await fetch('/api/meetings/upcoming/week');
    const meetings = await res.json();
    const tbody = document.getElementById('upcomingTable');

    if (!meetings.length) {
      tbody.innerHTML = emptyState(
        '📅',
        'No meetings this week',
        'Schedule a presentation to get started'
      );
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
            class="btn-ghost text-xs py-1 px-3">
            👁 View
          </button>
        </td>
      </tr>
    `).join('');

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

// ── OPEN SCHEDULE MODAL ──
async function openScheduleModal() {
  // Load schools into dropdown
  try {
    const res = await fetch('/api/schools');
    const schools = await res.json();
    const select = document.getElementById('m-school_id');

    select.innerHTML = `<option value="">-- Select a School --</option>` +
      schools.map(s => `
        <option value="${s.id}">
          ${s.school_name} ${s.city_province ? '— ' + s.city_province : ''}
        </option>
      `).join('');
  } catch (e) {
    showToast('Could not load schools', 'error');
  }

  openModal('scheduleModal');
}

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

    showToast('✅ Meeting scheduled!', 'success');
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
      '🏫 School Already Has a Meeting',
      data.error,
      'Please go to the Calendar and cancel or reschedule the existing meeting first.'
    );
  } else if (type === 'MAX_MEETINGS_REACHED') {
    showConflictAlert(
      '📅 Maximum Meetings Reached',
      data.error,
      'Only 3 meetings are allowed per day. Please choose a different date.'
    );
  } else if (type === 'TIME_SLOT_TAKEN') {
    showConflictAlert(
      '⏰ Time Slot Conflict',
      data.error,
      'Please choose a time at least 30 minutes away from existing meetings.'
    );
  } else if (type === 'OUTSIDE_METRO_MANILA') {
    showConflictAlert(
      '📍 Outside Metro Manila',
      data.error,
      'Switch to Online mode or contact your partner for areas outside Metro Manila.'
    );
  } else {
    showToast('Error: ' + data.error, 'error');
  }
}

// ── SHOW CONFLICT ALERT ──
function showConflictAlert(title, message, suggestion) {
  document.getElementById('conflictTitle').textContent   = title;
  document.getElementById('conflictMessage').textContent = message;
  document.getElementById('conflictSuggestion').textContent = suggestion;
  openModal('conflictModal');
}

// ── CHECK DATE WHEN ADMIN PICKS IT ──
async function checkDateAvailability(date) {
  if (!date) return;

  try {
    const res  = await fetch('/api/meetings/check/' + date);
    const data = await res.json();

    const indicator = document.getElementById('dateAvailability');
    if (!indicator) return;

    if (data.is_full) {
      indicator.innerHTML = `
        <div style="color:#991b1b; font-size:12px; margin-top:6px;
          padding:8px 12px; background:#fee2e2; border-radius:6px;">
          ❌ This date is fully booked (3/3 meetings).
          Please choose another date.
        </div>
      `;
    } else if (data.count === 0) {
      indicator.innerHTML = `
        <div style="color:#166534; font-size:12px; margin-top:6px;
          padding:8px 12px; background:#dcfce7; border-radius:6px;">
          ✅ This date is available (0/3 meetings scheduled)
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
          ⚠️ ${data.count}/3 meetings on this date.
          ${remaining} slot${remaining > 1 ? 's' : ''} remaining.<br/>
          <span style="color:#6b7280;">
            Existing: ${times}
          </span>
        </div>
      `;
    }
  } catch (e) {
    console.error('Could not check date availability');
  }
}

// ── VIEW MEETING ──
async function viewMeeting(id) {
  try {
    const res = await fetch('/api/meetings/' + id);
    const m = await res.json();
    currentMeetingId = id;

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
        ${m.meeting_link ?
          detailRow('Meeting Link',
            `<a href="${m.meeting_link}" target="_blank"
              style="color:var(--navy)">${m.meeting_link}</a>`) : ''}
        ${m.meeting_address ?
          detailRow('Address', m.meeting_address) : ''}
        ${detailRow('Status',   meetingStatusBadge(m.status))}
      </div>
      ${m.notes ? `
        <div style="margin-top:16px; padding:12px; background:#f9fafb;
          border-radius:8px; font-size:13px; color:#4b5563;">
          📝 ${m.notes}
        </div>` : ''}
      ${isCancelled ? `
        <div style="margin-top:16px; padding:12px; background:#fee2e2;
          border-radius:8px; font-size:13px; color:#991b1b;">
          ⚠️ This meeting was cancelled.
        </div>` : ''}
      ${isRescheduled ? `
        <div style="margin-top:16px; padding:12px; background:#fef3c7;
          border-radius:8px; font-size:13px; color:#92400e;">
          🔄 This meeting has been rescheduled.
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
        <button onclick="openRescheduleModal()" class="btn-outline text-sm">
          🔄 Reschedule
        </button>
        <button onclick="markAsDone()" class="btn-navy text-sm">
          ✅ Mark as Done
        </button>
        <button onclick="openCancelModal()" class="btn-ghost text-sm"
          style="color:#991b1b;">
          🗑 Cancel Meeting
        </button>
      `;
    }

    openModal('meetingModal');
  } catch (e) {
    showToast('Could not load meeting details', 'error');
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
    showToast('✅ Meeting marked as done!', 'success');
    closeModal('meetingModal');
    loadCalendar();
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
  document.getElementById('r-meeting_date').value = '';
  document.getElementById('r-meeting_time').value = '';
  document.getElementById('r-notes').value = '';
  closeModal('meetingModal');
  openModal('rescheduleModal');
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

    showToast('✅ Meeting rescheduled!', 'success');
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
   'm-meeting_type','m-meeting_mode','m-meeting_link',
   'm-meeting_address','m-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
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