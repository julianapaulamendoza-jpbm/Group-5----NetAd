const form = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const loginBtn = document.getElementById('loginBtn');
const togglePw = document.getElementById('togglePw');
const successOverlay = document.getElementById('successOverlay');
const dashboard = document.getElementById('dashboard');
const loginCard = document.getElementById('loginCard');
const logoutBtn = document.getElementById('logoutBtn');
const logsPage = document.getElementById('logsPage');
const logsTableBody = document.getElementById('logsTableBody');
const logoutBtn2 = document.getElementById('logoutBtn2');
let sessionLogs = [];
let currentLoginTime = null;
let currentLoginDate = null;

const eyeOpen = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const eyeClosed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

togglePw.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePw.innerHTML = isPassword ? eyeClosed : eyeOpen;
});

emailInput.addEventListener('input', () => {
  emailInput.classList.remove('error-field');
  emailError.classList.remove('show');
});

passwordInput.addEventListener('input', () => {
  passwordInput.classList.remove('error-field');
  passwordError.classList.remove('show');
});

function isValidEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  let valid = true;

  if (!isValidEmail(emailInput.value)) {
    emailInput.classList.add('error-field');
    emailError.classList.add('show');
    valid = false;
  }

  if (passwordInput.value.length < 6) {
    passwordInput.classList.add('error-field');
    passwordError.classList.add('show');
    valid = false;
  }

  if (!valid) return;

  if (emailInput.value !== 'group5@securewatch.com' || passwordInput.value !== 'group5123') {
    emailInput.classList.add('error-field');
    passwordInput.classList.add('error-field');
    emailError.textContent = 'Invalid credentials.';
    emailError.classList.add('show');
    return;
  }

  loginBtn.classList.add('loading');
  loginBtn.disabled = true;

  setTimeout(() => {
    const now = new Date();
  currentLoginTime = now.toTimeString().slice(0,8);
  currentLoginDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  sessionLogs.push({
    user: emailInput.value,
    timeIn: currentLoginTime,
    timeOut: null,
    date: currentLoginDate
  });
  renderLogs();
  loginCard.style.display = 'none';
  dashboard.classList.add('show');
}, 1800);
});

// Logout: go back to login
logoutBtn.addEventListener('click', () => {
  const now = new Date();
  const timeOut = now.toTimeString().slice(0,8);
  if (sessionLogs.length > 0) {
    sessionLogs[sessionLogs.length - 1].timeOut = timeOut;
  }
  dashboard.classList.remove('show');
  loginCard.style.display = '';
  loginBtn.classList.remove('loading');
  loginBtn.disabled = false;
  emailInput.value = '';
  passwordInput.value = '';
});

// Camera controls
let motionOn = false;
let feedPaused = false;

function toggleMotion() {
  motionOn = !motionOn;
  const alert = document.getElementById('motionAlert');
  alert.classList.toggle('show', motionOn);
  if (motionOn) addActivity('Motion Detected — Camera 01');
}

function toggleFeed() {
  feedPaused = !feedPaused;
  const status = document.getElementById('feedStatus');
  const btn = document.querySelector('.cam-controls button:last-of-type');
  status.textContent = feedPaused ? '● Paused' : '● Live';
  status.style.color = feedPaused ? '#cc2222' : '#00aa44';
  btn.textContent = feedPaused ? '▶ Resume Feed' : '⏸ Pause Feed';
}

function addActivity(msg) {
  const log = document.getElementById('activityLog');
  const now = new Date();
  const time = now.toTimeString().slice(0,8);
  const entry = document.createElement('div');
  entry.textContent = time + ' — ' + msg;
  if (log.firstChild && log.firstChild.textContent === 'No activity yet') log.innerHTML = '';
  log.prepend(entry);
}


// Show logs page
function showLogs() {
  dashboard.classList.remove('show');
  logsPage.classList.add('show');
}

// Show dashboard page
function showDashboard() {
  logsPage.classList.remove('show');
  dashboard.classList.add('show');
}

// Render logs table
function renderLogs() {
  if (sessionLogs.length === 0) {
    logsTableBody.innerHTML = '<tr><td colspan="4">No logs yet</td></tr>';
    return;
  }
  logsTableBody.innerHTML = sessionLogs.map(log => `
    <tr>
      <td>${log.user}</td>
      <td>${log.timeIn}</td>
      <td>${log.timeOut || '—'}</td>
      <td>${log.date}</td>
    </tr>
  `).join('');
}

// Logout logs page
logoutBtn2.addEventListener('click', () => {
  const now = new Date();
  const timeOut = now.toTimeString().slice(0,8);
  if (sessionLogs.length > 0) {
    sessionLogs[sessionLogs.length - 1].timeOut = timeOut;
  }
  renderLogs();
  logsPage.classList.remove('show');
  loginCard.style.display = '';
  loginBtn.classList.remove('loading');
  loginBtn.disabled = false;
  emailInput.value = '';
  passwordInput.value = '';
});
