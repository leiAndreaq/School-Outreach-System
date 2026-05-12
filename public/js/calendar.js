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
          <div class="meeting-dot" onclick="event.stopPropagation(); viewMeeting(${m.id})">
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
  const schoolId   = document.getElementById('m-school_id').value;
  const date       = document.getElementById('m-meeting_date').value;
  const time       = document.getElementById('m-meeting_time').value;

  if (!schoolId || !date || !time) {
    showToast('Please fill in School, Date, and Time', 'error');
    return;
  }

  const payload = {
    school_id:       schoolId,
    meeting_date:    date,
    meeting_time:    time,
    meeting_type:    document.getElementById('m-meeting_type').value,
    meeting_mode:    document.getElementById('m-meeting_mode').value,
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
      showToast('Error: ' + data.error, 'error');
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

// ── VIEW MEETING ──
async function viewMeeting(id) {
  try {
    const res = await fetch('/api/meetings/' + id);
    const m = await res.json();
    currentMeetingId = id;

    document.getElementById('meetingModalBody').innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 24px;">
        ${detailRow('School',       m.school_name)}
        ${detailRow('Contact',      m.contact_person)}
        ${detailRow('Date',         formatDateDisplay(m.meeting_date))}
        ${detailRow('Time',         formatTime(m.meeting_time))}
        ${detailRow('Type',         m.meeting_type)}
        ${detailRow('Mode',         m.meeting_mode)}
        ${m.meeting_link    ? detailRow('Meeting Link',
            `<a href="${m.meeting_link}" target="_blank"
              style="color:var(--navy)">${m.meeting_link}</a>`) : ''}
        ${m.meeting_address ? detailRow('Address', m.meeting_address) : ''}
        ${detailRow('Status',       meetingStatusBadge(m.status))}
      </div>
      ${m.notes ? `
        <div style="margin-top:16px; padding:12px; background:#f9fafb;
          border-radius:8px; font-size:13px; color:#4b5563;">
          📝 ${m.notes}
        </div>` : ''}
    `;

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
async function cancelMeeting() {
  if (!currentMeetingId) return;
  const confirmed = confirm('Are you sure you want to cancel this meeting?');
  if (!confirmed) return;

  try {
    await fetch('/api/meetings/' + currentMeetingId, {
      method: 'DELETE'
    });
    showToast('Meeting cancelled', '');
    closeModal('meetingModal');
    loadCalendar();
    loadDashboard();
  } catch (e) {
    showToast('Failed to cancel meeting', 'error');
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