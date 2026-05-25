// ── LOGIN STATE ──
let attempts = 0;
const MAX_ATTEMPTS = 5;

// ── HANDLE LOGIN ──
async function handleLogin() {
  const password = document.getElementById('passwordInput').value.trim();
  const btn      = document.getElementById('loginBtn');
  const btnText  = document.getElementById('loginBtnText');

  if (!password) {
    showError('Please enter your password.');
    shakeCard();
    return;
  }

  // Disable button while logging in
  btn.disabled     = true;
  btnText.textContent = 'Logging in...';

  try {
    const res  = await fetch('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.code === 'RATE_LIMITED') {
      showError('⚠️ Too many attempts. Please wait 15 minutes.');
      btn.disabled     = false;
      btnText.textContent = 'Login to CRM';
      return;
    }

    if (!res.ok) {
      attempts++;
      const remaining = MAX_ATTEMPTS - attempts;

      shakeCard();

      if (remaining <= 0) {
        showError('Too many failed attempts. Please wait 15 minutes.');
        btn.disabled     = true;
        btnText.textContent = 'Locked';
        return;
      }

      showError('Incorrect password. Please try again.');

      if (remaining <= 3) {
        showAttemptsWarning(
          `⚠️ ${remaining} attempt${remaining > 1 ? 's' : ''} remaining before lockout.`
        );
      }

      btn.disabled        = false;
      btnText.textContent = 'Login to CRM';

      // Clear password field
      document.getElementById('passwordInput').value = '';
      document.getElementById('passwordInput').focus();
      return;
    }

    // ── SUCCESS ──
    btnText.textContent = '✅ Success! Redirecting...';
    setTimeout(() => {
      window.location.href = '/';
    }, 800);

  } catch (e) {
    showError('Something went wrong. Please try again.');
    btn.disabled        = false;
    btnText.textContent = 'Login to CRM';
  }
}

// ── HANDLE ENTER KEY ──
function handleKeyDown(e) {
  if (e.key === 'Enter') handleLogin();
}

// ── TOGGLE PASSWORD VISIBILITY ──
const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function togglePassword() {
  const input    = document.getElementById('passwordInput');
  const btn      = document.getElementById('toggleBtn');
  const isHidden = input.type === 'password';
  input.type     = isHidden ? 'text' : 'password';
  btn.innerHTML  = isHidden ? EYE_OFF : EYE_OPEN;
  btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
}

// ── SHOW ERROR ──
function showError(message) {
  const el = document.getElementById('loginError');
  el.textContent = message;
  el.classList.add('show');
}

// ── CLEAR ERROR ──
function clearError() {
  const el = document.getElementById('loginError');
  el.classList.remove('show');
}

// ── SHOW ATTEMPTS WARNING ──
function showAttemptsWarning(message) {
  const el = document.getElementById('attemptsWarning');
  el.textContent = message;
  el.classList.add('show');
}

// ── SHAKE ANIMATION ──
function shakeCard() {
  const card = document.querySelector('.login-card');
  card.classList.remove('shake');
  void card.offsetWidth; // force reflow
  card.classList.add('shake');
}

// ── CHECK IF ALREADY LOGGED IN ──
window.addEventListener('load', async () => {
  try {
    const res  = await fetch('/api/session');
    const data = await res.json();
    if (data.authenticated) {
      window.location.href = '/';
    }
  } catch (e) {
    console.error('Session check failed');
  }
});