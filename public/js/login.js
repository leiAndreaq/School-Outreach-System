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
function togglePassword() {
  const input   = document.getElementById('passwordInput');
  const btn     = document.getElementById('toggleBtn');
  const isHidden = input.type === 'password';
  input.type    = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁';
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