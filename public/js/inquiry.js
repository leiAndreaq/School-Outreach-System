// ── FIELDS FOR PROGRESS BAR ──
const allFields = [
  'contact_person', 'position', 'email', 'phone',
  'school_name', 'school_type', 'level_offered',
  'estimated_students', 'city_province',
  'heard_from', 'message'
];

// ── CALENDAR STATE ──
let calYear      = new Date().getFullYear();
let calMonth     = new Date().getMonth();
let selectedDate = '';
let selectedTime = '';
let selectedMode = '';
let availability = {};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── PROGRESS BAR ──
function updateProgress() {
  const filled = allFields.filter(id => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== '';
  }).length;

  const total      = allFields.length + 3; // +mode +date +time
  const extra      = (selectedMode ? 1 : 0) +
                     (selectedDate ? 1 : 0) +
                     (selectedTime ? 1 : 0);
  const pct        = Math.round(((filled + extra) / total) * 100);

  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = pct + '% Complete';
}

allFields.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input',  updateProgress);
    el.addEventListener('change', updateProgress);
  }
});

// ── MODE SELECTOR ──
function selectMode(mode) {
  selectedMode = mode.toUpperCase();
  selectedDate = '';
  selectedTime = '';

  // Update mode card UI
  ['online','onsite'].forEach(m => {
    const card = document.getElementById('mode-' + m);
    if (card) card.classList.remove('selected');
  });
  const selected = document.getElementById('mode-' + mode);
  if (selected) selected.classList.add('selected');

  // Update hidden radio
  const radio = document.querySelector(
    `input[name="preferred_mode"][value="${mode.toUpperCase()}"]`
  );
  if (radio) radio.checked = true;

  // Show/hide onsite warning
  const warning = document.getElementById('onsiteWarning');
  if (warning) {
    warning.style.display = mode === 'onsite' ? 'block' : 'none';
  }

  // Show calendar
  document.getElementById('calendarSection').style.display = 'block';

  // Reset summary
  updateSummary();

  // Load availability
  loadAvailability(calYear, calMonth);

  // Hide time slots until date picked
  document.getElementById('timeSlotsWrapper').style.display = 'none';
  document.getElementById('timeSlotsContainer').innerHTML   = '';

  updateProgress();
}

// ── UPDATE SELECTION SUMMARY ──
function updateSummary() {
  const summary    = document.getElementById('selectionSummary');
  const summaryTxt = document.getElementById('summaryText');
  if (!summary || !summaryTxt) return;

  if (!selectedDate && !selectedTime) {
    summary.style.display = 'none';
    return;
  }

  let text = '';

  if (selectedDate) {
    const d = new Date(selectedDate + 'T00:00:00');
    text += d.toLocaleDateString('en-PH', {
      weekday: 'long',
      month:   'long',
      day:     'numeric',
      year:    'numeric'
    });
  }

  if (selectedTime) {
    text += ' at ' + formatSlotTime(selectedTime);
  } else if (selectedDate) {
    text += ' — please select a time below';
  }

  summaryTxt.textContent  = text;
  summary.style.display   = 'block';
}

// ── LOAD AVAILABILITY FOR MONTH ──
async function loadAvailability(year, month) {
  try {
    const res    = await fetch(`/api/availability/${year}/${month + 1}`);
    availability = await res.json();
  } catch (e) {
    availability = {};
  }
  renderCalendar(year, month);
}

// ── RENDER AVAILABILITY CALENDAR ──
function renderCalendar(year, month) {
  document.getElementById('availCalTitle').textContent =
    MONTHS[month] + ' ' + year;

  const grid        = document.getElementById('availGrid');
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();
  today.setHours(0, 0, 0, 0);

  let html = '';

  // Empty cells
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="avail-day empty"></div>`;
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cellDate = new Date(dateStr + 'T00:00:00');
    const isToday  = cellDate.getTime() === today.getTime();
    const isPast   = cellDate < today;

    const info       = availability[dateStr];
    const count      = info ? info.count : 0;
    const isFull     = count >= 3;
    const isLimited  = count > 0 && count < 3;
    const isSelected = dateStr === selectedDate;

    let cls = 'avail-day';
    let dot = '';

    if (isPast) {
      cls += ' past';
    } else if (isFull) {
      cls += ' full';
      dot  = `<div class="avail-dot"></div>`;
    } else if (isLimited) {
      cls += ' limited';
      dot  = `<div class="avail-dot"></div>`;
    } else {
      cls += ' available';
      dot  = `<div class="avail-dot"></div>`;
    }

    if (isToday)    cls += ' today';
    if (isSelected) cls += ' selected';

    const clickable = !isPast && !isFull;

    html += `
      <div class="${cls}"
        ${clickable ? `onclick="selectDay('${dateStr}')"` : ''}>
        <span>${day}</span>
        ${dot}
      </div>
    `;
  }

  grid.innerHTML = html;
}

// ── SELECT A DAY ──
async function selectDay(dateStr) {
  selectedDate = dateStr;
  selectedTime = '';
  renderCalendar(calYear, calMonth);
  updateSummary();
  updateProgress();
  await loadTimeSlots(dateStr);
}

// ── LOAD TIME SLOTS ──
async function loadTimeSlots(date) {
  const container = document.getElementById('timeSlotsContainer');
  const wrapper   = document.getElementById('timeSlotsWrapper');
  if (!container || !wrapper) return;

  wrapper.style.display   = 'block';
  container.innerHTML = `
    <div class="time-slots-loading">⏳ Loading available times...</div>
  `;

  try {
    const res  = await fetch('/api/availability/slots/' + date);
    const data = await res.json();

    container.innerHTML = `
      <div class="time-slots-grid">
        ${data.slots.map(slot => `
          <div
            class="time-slot ${!slot.available ? 'booked' : ''}"
            id="slot-${slot.time}"
            ${slot.available
              ? `onclick="selectTimeSlot('${slot.time}')"` : ''}>
            ${formatSlotTime(slot.time)}
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `
      <div class="time-slots-placeholder">
        Could not load time slots. Please try again.
      </div>
    `;
  }
}

// ── SELECT TIME SLOT ──
function selectTimeSlot(time) {
  selectedTime = time;

  document.querySelectorAll('.time-slot').forEach(el => {
    el.classList.remove('selected');
  });
  const slotEl = document.getElementById('slot-' + time);
  if (slotEl) slotEl.classList.add('selected');

  // Move summary BELOW time slots with spacing
  const summary          = document.getElementById('selectionSummary');
  const timeSlotsWrapper = document.getElementById('timeSlotsWrapper');
  if (summary && timeSlotsWrapper) {
    summary.style.marginTop = '16px';
    timeSlotsWrapper.appendChild(summary);
  }

  updateSummary();
  updateProgress();
}

// ── FORMAT SLOT TIME ──
function formatSlotTime(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ── NAVIGATE MONTHS ──
function availPrevMonth() {
  const today = new Date();
  if (calYear  === today.getFullYear() &&
      calMonth === today.getMonth()) return;
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  loadAvailability(calYear, calMonth);
}

function availNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  loadAvailability(calYear, calMonth);
}

// ── SUBMIT FORM ──
async function submitForm(e) {
  e.preventDefault();

  // Validate mode selected
  if (!selectedMode) {
    showToast('Please select a meeting mode first', 'error');
    return;
  }

  // Validate date selected
  if (!selectedDate) {
    showToast('Please select a preferred date', 'error');
    return;
  }

  // Validate time selected
  if (!selectedTime) {
    showToast('Please select a preferred time slot', 'error');
    return;
  }

  // Warn if onsite outside Metro Manila
  if (selectedMode === 'ONSITE') {
    const city = document.getElementById('city_province').value.toLowerCase();
    const metroManila = [
      'manila','quezon city','makati','pasig','taguig',
      'mandaluyong','marikina','pasay','caloocan','malabon',
      'navotas','valenzuela','las pinas','las piñas',
      'muntinlupa','paranaque','parañaque','pateros','san juan'
    ];
    const isMetro = metroManila.some(c => city.includes(c));
    if (city && !isMetro) {
      showToast(
        '⚠️ Onsite is Metro Manila only. Switching to Online.',
        'error'
      );
      selectMode('online');
      return;
    }
  }

  const btn  = document.getElementById('submitBtn');
  const text = document.getElementById('submitText');
  btn.disabled     = true;
  text.textContent = 'Submitting...';

  const modeEl = document.querySelector(
    'input[name="preferred_mode"]:checked'
  );

  const payload = {
    school_name:        document.getElementById('school_name').value.trim(),
    school_type:        document.getElementById('school_type').value,
    level_offered:      document.getElementById('level_offered').value,
    estimated_students: document.getElementById('estimated_students').value || null,
    city_province:      document.getElementById('city_province').value,
    region:             document.getElementById('region').value,
    contact_person:     document.getElementById('contact_person').value.trim(),
    position:           document.getElementById('position').value,
    email:              document.getElementById('email').value.trim(),
    phone:              document.getElementById('phone').value,
    preferred_date:     selectedDate,
    preferred_time:     formatSlotTime(selectedTime),
    preferred_mode:     selectedMode,
    heard_from:         document.getElementById('heard_from').value,
    message:            document.getElementById('message').value,
  };

  try {
    const res  = await fetch('/api/inquiries', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.error) {
      showToast('Error: ' + data.error, 'error');
      btn.disabled     = false;
      text.textContent = 'Submit Inquiry ✉️';
      return;
    }

    document.getElementById('inquiryForm').style.display   = 'none';
    document.getElementById('successScreen').style.display = 'block';

  } catch (err) {
    showToast('Something went wrong. Please try again.', 'error');
    btn.disabled     = false;
    text.textContent = 'Submit Inquiry ✉️';
  }
}

// ── TOAST ──
function showToast(message, type = '') {
  let toast = document.getElementById('inquiryToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'inquiryToast';
    toast.style.cssText = `
      position:fixed; bottom:28px; right:28px;
      padding:12px 20px; border-radius:8px;
      font-size:13px; font-weight:500;
      box-shadow:0 8px 30px rgba(0,0,0,0.2);
      z-index:999; transition:all 0.25s;
      transform:translateY(80px); opacity:0;
      font-family:'Inter',sans-serif;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent        = message;
  toast.style.background   = type === 'error' ? '#D01B1B' : '#1B1F6B';
  toast.style.color        = 'white';
  setTimeout(() => {
    toast.style.transform  = 'translateY(0)';
    toast.style.opacity    = '1';
  }, 10);
  setTimeout(() => {
    toast.style.transform  = 'translateY(80px)';
    toast.style.opacity    = '0';
  }, 3500);
}

// ── INIT ──
window.addEventListener('load', () => {
  // No default mode selected — user must choose
});