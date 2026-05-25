'use strict';

/* ── DOM helpers ── */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

/* ── App State ── */
let selectedMode = '';
let selectedDate = '';
let selectedTime = '';
let calYear      = new Date().getFullYear();
let calMonth     = new Date().getMonth();
let currentStep  = 1;
const TOTAL_STEPS = 4;

/* ── Progress bar fields (required fields only — excludes optional Additional Info) ── */
const PROGRESS_FIELDS = [
  'school_name', 'school_type', 'level_offered',
  'estimated_students', 'region', 'city_municipality',
  'contact_person', 'position', 'email', 'phone'
];

/* ── PSGC API ── */
const PSGC_BASE = 'https://psgc.gitlab.io/api';
const NCR_CODE  = '130000000';
let psgcRegionCode   = '';
let psgcProvinceCode = '';

/* ── Month labels ── */
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

/* ── Static time slot fallback (used if API is unreachable) ── */
const TIME_SLOTS = [
  { label: '8:00 AM',  value: '08:00', avail: true  },
  { label: '9:00 AM',  value: '09:00', avail: true  },
  { label: '10:00 AM', value: '10:00', avail: true  },
  { label: '11:00 AM', value: '11:00', avail: true  },
  { label: '1:00 PM',  value: '13:00', avail: true  },
  { label: '2:00 PM',  value: '14:00', avail: true  },
  { label: '3:00 PM',  value: '15:00', avail: true  },
  { label: '4:00 PM',  value: '16:00', avail: true  },
];


/* ────────────────────────────────────────────────
   PSGC API — Cascading Region / Province / City
──────────────────────────────────────────────── */
async function loadPsgcRegions() {
  const sel = $('region');
  if (!sel) return;
  try {
    const res  = await fetch(PSGC_BASE + '/regions/');
    const data = await res.json();
    const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">-- Select Region --</option>' +
      sorted.map(r => `<option value="${r.code}">${r.name}</option>`).join('');
  } catch (_) {
    sel.innerHTML = '<option value="">Could not load regions</option>';
  }
}

async function onRegionChange() {
  const sel  = $('region');
  const code = sel.value;
  psgcRegionCode   = code;
  psgcProvinceCode = '';

  // Reset downstream selects
  resetSelect('province', '-- Select Province --');
  resetSelect('city_municipality', '-- Select City / Municipality --');
  $('city_province').value = '';
  $('provinceField').style.display = 'none';
  $('cityField').style.display     = 'none';

  // Regional partner warning
  const warn = $('regionalWarning');
  if (warn) warn.style.display = (code && code !== NCR_CODE) ? 'block' : 'none';

  if (!code) { updateProgress(); return; }

  if (code === NCR_CODE) {
    // NCR has no provinces — load cities directly
    await loadCitiesForRegion(NCR_CODE);
  } else {
    await loadProvinces(code);
  }
  updateProgress();
}

async function loadProvinces(regionCode) {
  const sel = $('province');
  sel.innerHTML = '<option value="">Loading…</option>';
  $('provinceField').style.display = 'block';
  try {
    const res  = await fetch(`${PSGC_BASE}/regions/${regionCode}/provinces/`);
    const data = await res.json();
    const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">-- Select Province --</option>' +
      sorted.map(p => `<option value="${p.code}">${p.name}</option>`).join('');
  } catch (_) {
    sel.innerHTML = '<option value="">Could not load provinces</option>';
  }
}

async function onProvinceChange() {
  const sel  = $('province');
  const code = sel.value;
  psgcProvinceCode = code;

  resetSelect('city_municipality', '-- Select City / Municipality --');
  $('city_province').value = '';
  $('cityField').style.display = 'none';

  if (!code) { updateProgress(); return; }
  await loadCitiesForProvince(code);
  updateProgress();
}

async function loadCitiesForRegion(regionCode) {
  const sel = $('city_municipality');
  sel.innerHTML = '<option value="">Loading…</option>';
  $('cityField').style.display = 'block';
  try {
    const res  = await fetch(`${PSGC_BASE}/regions/${regionCode}/cities-municipalities/`);
    const data = await res.json();
    const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">-- Select City / Municipality --</option>' +
      sorted.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
  } catch (_) {
    sel.innerHTML = '<option value="">Could not load cities</option>';
  }
}

async function loadCitiesForProvince(provinceCode) {
  const sel = $('city_municipality');
  sel.innerHTML = '<option value="">Loading…</option>';
  $('cityField').style.display = 'block';
  try {
    const res  = await fetch(`${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities/`);
    const data = await res.json();
    const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">-- Select City / Municipality --</option>' +
      sorted.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
  } catch (_) {
    sel.innerHTML = '<option value="">Could not load cities</option>';
  }
}

function onCityChange() {
  const sel = $('city_municipality');
  const selectedOption = sel.options[sel.selectedIndex];
  $('city_province').value = selectedOption ? selectedOption.text : '';
  updateProgress();
}

function resetSelect(id, placeholder) {
  const el = $(id);
  if (el) el.innerHTML = `<option value="">${placeholder}</option>`;
}


/* ────────────────────────────────────────────────
   PRIVACY MODAL
──────────────────────────────────────────────── */
function openPrivacy() {
  const overlay = $('privacyOverlay');
  $('privacyCheck').checked = false;
  $('btnAgree').disabled    = true;
  $('btnAgree').style.opacity       = '0.38';
  $('btnAgree').style.pointerEvents = 'none';
  overlay.classList.add('active');
  overlay.removeAttribute('aria-hidden');
}

function closePrivacy() {
  $('privacyOverlay').classList.remove('active');
  $('privacyOverlay').setAttribute('aria-hidden', 'true');
}

function toggleAgree(cb) {
  const btn = $('btnAgree');
  if (cb.checked) {
    btn.disabled            = false;
    btn.style.opacity       = '1';
    btn.style.pointerEvents = 'all';
  } else {
    btn.disabled            = true;
    btn.style.opacity       = '0.38';
    btn.style.pointerEvents = 'none';
  }
}

function proceedToForm() {
  if (!$('privacyCheck').checked) return;
  closePrivacy();
  $('landingPage').style.display = 'none';
  $('formPage').classList.add('active');
  $('formPage').removeAttribute('aria-hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Click outside modal to close */
$('privacyOverlay').addEventListener('click', function(e) {
  if (e.target === this) closePrivacy();
});


/* ────────────────────────────────────────────────
   BACK BUTTON
──────────────────────────────────────────────── */
function goBackToLanding() {
  $('formPage').classList.remove('active');
  $('formPage').setAttribute('aria-hidden', 'true');
  $('landingPage').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


/* ────────────────────────────────────────────────
   PROGRESS BAR
──────────────────────────────────────────────── */
function updateProgress() {
  const filled = PROGRESS_FIELDS.filter(id => {
    const el = $(id);
    return el && el.value.trim() !== '';
  }).length;

  const total = PROGRESS_FIELDS.length + 3;
  const extra = (selectedMode ? 1 : 0) +
                (selectedDate ? 1 : 0) +
                (selectedTime ? 1 : 0);

  const pct = Math.min(Math.round(((filled + extra) / total) * 100), 100);
  $('progressBar').style.width = pct + '%';
  $('progressPct').textContent = pct + '% Complete';
}

/* Attach change listeners */
window.addEventListener('DOMContentLoaded', () => {
  PROGRESS_FIELDS.forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('input',  updateProgress);
      el.addEventListener('change', updateProgress);
    }
  });

  /* Keyboard support for mode cards */
  $$('.mode-card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  loadPsgcRegions();
  updateProgress();
});


/* ────────────────────────────────────────────────
   STEP NAVIGATION
──────────────────────────────────────────────── */
function showStep(n) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = $('step-' + i);
    if (el) el.style.display = i === n ? 'block' : 'none';
  }
  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
}

function prevStep() {
  if (currentStep > 1) showStep(currentStep - 1);
}

function validateStep(step) {
  if (step === 1) {
    if (!$('school_name').value.trim()) {
      showToast('Please enter your school name.', 'error');
      $('school_name').focus(); return false;
    }
    if (!$('school_type').value) {
      showToast('Please select the school type.', 'error');
      $('school_type').focus(); return false;
    }
    if (!$('level_offered').value) {
      showToast('Please select the level offered.', 'error');
      $('level_offered').focus(); return false;
    }
    if (!$('estimated_students').value) {
      showToast('Please enter the estimated number of students.', 'error');
      $('estimated_students').focus(); return false;
    }
    if (!$('region').value) {
      showToast('Please select your region.', 'error');
      $('region').focus(); return false;
    }
    if ($('provinceField').style.display !== 'none' && !$('province').value) {
      showToast('Please select your province.', 'error');
      $('province').focus(); return false;
    }
    if (!$('city_municipality').value) {
      showToast('Please select your city or municipality.', 'error');
      $('city_municipality').focus(); return false;
    }
  } else if (step === 2) {
    if (!$('contact_person').value.trim()) {
      showToast('Please enter the contact person name.', 'error');
      $('contact_person').focus(); return false;
    }
    if (!$('position').value.trim()) {
      showToast('Please enter the contact person\'s position.', 'error');
      $('position').focus(); return false;
    }
    const email = $('email').value.trim();
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      $('email').focus(); return false;
    }
    if (!$('phone').value.trim()) {
      showToast('Please enter a phone number.', 'error');
      $('phone').focus(); return false;
    }
  } else if (step === 3) {
    if (!selectedMode) {
      showToast('Please select a preferred meeting mode.', 'error'); return false;
    }
    if (!selectedDate) {
      showToast('Please select a preferred date.', 'error'); return false;
    }
    if (!selectedTime) {
      showToast('Please select a preferred time slot.', 'error'); return false;
    }
  }
  // Step 4 is fully optional — always valid
  return true;
}

function clearAdditional() {
  selectedMode = '';
  selectedDate = '';
  selectedTime = '';
  calYear  = new Date().getFullYear();
  calMonth = new Date().getMonth();

  const textFields = [
    'school_name','contact_person','position','email','phone',
    'city_province','estimated_students','message',
    'preferred_date','preferred_time_hidden','hp_website'
  ];
  textFields.forEach(id => { const el = $(id); if (el) el.value = ''; });

  const selectFields = ['school_type','level_offered','region','heard_from'];
  selectFields.forEach(id => { const el = $(id); if (el) el.selectedIndex = 0; });

  // Reset PSGC cascading fields
  psgcRegionCode   = '';
  psgcProvinceCode = '';
  resetSelect('province', '-- Select Province --');
  resetSelect('city_municipality', '-- Select City / Municipality --');
  $('provinceField').style.display   = 'none';
  $('cityField').style.display       = 'none';
  $('regionalWarning').style.display = 'none';

  $$('input[name="preferred_mode"]').forEach(r => r.checked = false);
  $$('.mode-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });

  $('onsiteWarn').style.display  = 'none';
  $('calSection').style.display  = 'none';
  $('timeSection').style.display = 'none';
  $('selSummary').style.display  = 'none';
  if ($('timeGrid')) $('timeGrid').innerHTML = '';

  currentStep = 1;
  showStep(1);
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


/* ────────────────────────────────────────────────
   MEETING MODE
──────────────────────────────────────────────── */
function selectMode(mode) {
  selectedMode = mode.toUpperCase();

  /* Reset date/time when mode changes */
  selectedDate = '';
  selectedTime = '';
  $('preferred_date').value        = '';
  $('preferred_time_hidden').value = '';

  /* Update mode card visuals */
  $$('.mode-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  const card = $('mode-' + mode);
  if (card) {
    card.classList.add('selected');
    card.setAttribute('aria-pressed', 'true');
  }

  /* Check hidden radio */
  const radio = $('radio_' + mode);
  if (radio) radio.checked = true;

  /* Onsite warning */
  $('onsiteWarn').style.display = (mode === 'onsite') ? 'block' : 'none';

  /* Show calendar */
  $('calSection').style.display = 'block';
  $('selSummary').style.display  = 'none';

  /* Re-render calendar with fresh data */
  loadAvailability(calYear, calMonth);

  /* Hide time slots until date picked */
  $('timeSection').style.display = 'none';
  $('timeGrid').innerHTML        = '';

  updateProgress();
}


/* ────────────────────────────────────────────────
   CALENDAR — Availability
──────────────────────────────────────────────── */
async function loadAvailability(year, month) {
  let avail = {};
  try {
    const res = await fetch(`/api/availability/${year}/${month + 1}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      avail = await res.json();
    } else {
      avail = generateMockAvailability(year, month);
    }
  } catch (_) {
    avail = generateMockAvailability(year, month);
  }
  renderCalendar(year, month, avail);
}

function generateMockAvailability(year, month) {
  const avail = {};
  const days  = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const key  = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const seed = (year * 100 + month * 10 + d) % 10;
    if (seed < 2)      avail[key] = { count: 3 };
    else if (seed < 4) avail[key] = { count: 2 };
    else               avail[key] = { count: 0 };
  }
  return avail;
}

function renderCalendar(year, month, avail) {
  $('calTitle').textContent = MONTHS[month] + ' ' + year;

  const grid        = $('calGrid');
  grid.innerHTML    = '';
  const today       = new Date(); today.setHours(0,0,0,0);
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  /* Empty leading cells */
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }

  /* Day cells */
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cellDate = new Date(dateStr + 'T00:00:00');
    const isPast   = cellDate < today;
    const isWknd   = cellDate.getDay() === 0 || cellDate.getDay() === 6;

    const cell = document.createElement('div');
    cell.textContent = d;

    if (isPast || isWknd) {
      cell.className = 'cal-cell past';
    } else {
      const info   = avail[dateStr];
      const count  = info ? info.count : 0;
      const isFull = count >= 3;
      const isLim  = count >= 1 && count < 3;

      if (isFull) {
        cell.className = 'cal-cell booked';
      } else {
        const base = isLim ? 'limited' : 'available';
        cell.className = 'cal-cell ' + base + (selectedDate === dateStr ? ' selected' : '');
        cell.onclick   = () => selectDate(dateStr);
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `${MONTHS[month]} ${d}`);
        cell.setAttribute('tabindex', '0');
        cell.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDate(dateStr); }
        });
      }
    }

    grid.appendChild(cell);
  }
}

/* ── Calendar navigation ── */
function calPrev() {
  const now = new Date();
  if (calYear === now.getFullYear() && calMonth === now.getMonth()) return;
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  loadAvailability(calYear, calMonth);
}

function calNext() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  loadAvailability(calYear, calMonth);
}

/* ── Select a day ── */
function selectDate(dateStr) {
  selectedDate = dateStr;
  $('preferred_date').value = dateStr;

  loadAvailability(calYear, calMonth);

  $('timeSection').style.display = 'block';
  renderTimeSlots();
  updateSummary();
  updateProgress();
}


/* ────────────────────────────────────────────────
   TIME SLOTS
──────────────────────────────────────────────── */
async function renderTimeSlots() {
  const grid = $('timeGrid');
  grid.innerHTML = '<div style="font-size:13px;color:#9ca3af;padding:8px 0">Loading available times…</div>';

  let slots = TIME_SLOTS;

  try {
    const res = await fetch(`/api/availability/slots/${selectedDate}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.slots)) {
        slots = data.slots.map(s => ({
          label: formatTime(s.time),
          value: s.time,
          avail: !!s.available
        }));
      }
    }
  } catch (_) { /* use static fallback */ }

  grid.innerHTML = '';
  slots.forEach(slot => {
    const el = document.createElement('div');
    el.className  = 'time-slot' + (!slot.avail ? ' unavail' : '') +
                    (selectedTime === slot.value ? ' selected' : '');
    el.textContent = slot.label;
    if (slot.avail) {
      el.onclick = () => pickTime(slot.value, slot.label);
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickTime(slot.value, slot.label); }
      });
    }
    grid.appendChild(el);
  });
}

function pickTime(value, label) {
  selectedTime = value;
  $('preferred_time_hidden').value = label;
  renderTimeSlots();
  updateSummary();
  updateProgress();
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
}


/* ────────────────────────────────────────────────
   SELECTION SUMMARY
──────────────────────────────────────────────── */
function updateSummary() {
  const el = $('selSummary');
  if (!selectedDate) { el.style.display = 'none'; return; }

  const [y, mo, d] = selectedDate.split('-').map(Number);
  const dt         = new Date(y, mo - 1, d);
  const dateLabel  = dt.toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const timeLabel  = selectedTime
    ? ' at ' + formatTime(selectedTime)
    : ' — please select a time below';

  el.textContent   = '📅 ' + dateLabel + timeLabel;
  el.style.display = 'block';
}


/* ────────────────────────────────────────────────
   FORM SUBMIT
──────────────────────────────────────────────── */
async function submitForm(e) {
  e.preventDefault();

  /* Honeypot check */
  if ($('hp_website') && $('hp_website').value.trim() !== '') {
    fakeSuccess(); return;
  }

  /* Safety-net validation (each step already validated before advancing) */
  const schoolName = $('school_name').value.trim();
  const contact    = $('contact_person').value.trim();
  const email      = $('email').value.trim();

  if (!schoolName || !contact || !email || !email.includes('@') ||
      !selectedMode || !selectedDate || !selectedTime) {
    showToast('Please complete all required fields.', 'error');
    return;
  }

  /* Onsite Metro Manila check — use PSGC region code for accuracy */
  if (selectedMode === 'ONSITE' && psgcRegionCode && psgcRegionCode !== NCR_CODE) {
    showToast('⚠️ Onsite visits are Metro Manila only. Switched to Online.', 'warn');
    selectMode('online');
    return;
  }

  /* Disable submit button */
  const btn = $('submitBtn');
  btn.disabled = true;
  $('submitText').textContent = 'Submitting…';

  /* Build payload */
  const payload = {
    school_name:        schoolName,
    school_type:        $('school_type').value        || null,
    level_offered:      $('level_offered').value      || null,
    estimated_students: $('estimated_students').value ? Number($('estimated_students').value) : null,
    city_province:      $('city_province').value.trim() || null,
    region:             $('region').value              || null,
    contact_person:     contact,
    position:           $('position').value.trim()    || null,
    email:              email,
    phone:              $('phone').value.trim()        || null,
    preferred_date:     selectedDate,
    preferred_time:     formatTime(selectedTime),
    preferred_mode:     selectedMode,
    heard_from:         $('heard_from').value          || null,
    message:            $('message').value.trim()      || null,
  };

  /* POST to backend */
  try {
    const res  = await fetch('/api/inquiries', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.code === 'RATE_LIMITED'
        ? '⚠️ Too many submissions. Please try again after 1 hour.'
        : data.code === 'VALIDATION_ERROR'
          ? '⚠️ ' + data.error
          : (data.error || 'Something went wrong. Please try again.');
      showToast(msg, 'error');
      btn.disabled = false;
      $('submitText').textContent = 'Submit Inquiry ✉️';
      return;
    }

    showSuccessScreen(payload);

  } catch (err) {
    showToast('Network error. Please check your connection and try again.', 'error');
    btn.disabled = false;
    $('submitText').textContent = 'Submit Inquiry ✉️';
  }
}

function fakeSuccess() {
  $('formPage').classList.remove('active');
  $('successPage').classList.add('active');
  $('successPage').removeAttribute('aria-hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


/* ────────────────────────────────────────────────
   SUCCESS SCREEN
──────────────────────────────────────────────── */
function showSuccessScreen(payload) {
  const summaryCard = $('successSummary');
  if (summaryCard) {
    const rows = [
      { label: 'School',  value: payload.school_name },
      { label: 'Contact', value: payload.contact_person + (payload.position ? ` (${payload.position})` : '') },
      { label: 'Email',   value: payload.email },
      { label: 'Mode',    value: payload.preferred_mode === 'ONLINE' ? '💻 Online (Google Meet / Zoom)' : '🏫 Onsite (at your school)' },
      { label: 'Date',    value: (() => {
          const [y,m,d] = payload.preferred_date.split('-').map(Number);
          return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
          });
        })()
      },
      { label: 'Time',    value: payload.preferred_time },
    ];
    summaryCard.innerHTML = `
      <div class="sum-title">Your Submission Summary</div>
      ${rows.map(r => `
        <div class="sum-row">
          <span class="sum-label">${r.label}</span>
          <span class="sum-value">${escHtml(String(r.value || '—'))}</span>
        </div>
      `).join('')}
    `;
  }

  $('formPage').classList.remove('active');
  $('successPage').classList.add('active');
  $('successPage').removeAttribute('aria-hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ────────────────────────────────────────────────
   RESET — "Submit Another Response"
──────────────────────────────────────────────── */
function resetAll() {
  selectedMode = '';
  selectedDate = '';
  selectedTime = '';
  calYear      = new Date().getFullYear();
  calMonth     = new Date().getMonth();

  const textFields = [
    'school_name','contact_person','position','email','phone',
    'city_province','estimated_students','message',
    'preferred_date','preferred_time_hidden','hp_website'
  ];
  textFields.forEach(id => { const el = $(id); if (el) el.value = ''; });

  const selectFields = ['school_type','level_offered','region','heard_from'];
  selectFields.forEach(id => { const el = $(id); if (el) el.selectedIndex = 0; });

  // Reset PSGC cascading fields
  psgcRegionCode   = '';
  psgcProvinceCode = '';
  resetSelect('province', '-- Select Province --');
  resetSelect('city_municipality', '-- Select City / Municipality --');
  $('provinceField').style.display  = 'none';
  $('cityField').style.display      = 'none';
  $('regionalWarning').style.display = 'none';

  $$('input[name="preferred_mode"]').forEach(r => r.checked = false);

  $$('.mode-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  $('onsiteWarn').style.display  = 'none';
  $('calSection').style.display  = 'none';
  $('timeSection').style.display = 'none';
  $('selSummary').style.display  = 'none';
  if ($('timeGrid')) $('timeGrid').innerHTML = '';

  currentStep = 1;
  showStep(1);
  updateProgress();

  $('submitBtn').disabled         = false;
  $('submitText').textContent     = 'Submit Inquiry ✉️';

  const sum = $('successSummary');
  if (sum) sum.innerHTML = '';

  $('successPage').classList.remove('active');
  $('successPage').setAttribute('aria-hidden', 'true');
  $('formPage').classList.remove('active');
  $('formPage').setAttribute('aria-hidden', 'true');
  $('landingPage').style.display = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}


/* ────────────────────────────────────────────────
   TOAST NOTIFICATION
──────────────────────────────────────────────── */
let _toastTimer = null;

function showToast(message, type = 'error') {
  const el = $('toastEl');
  el.textContent = message;
  el.className   = `show toast-${type}`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 4000);
}
