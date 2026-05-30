const form = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const loginBtn = document.getElementById('loginBtn');
const togglePw = document.getElementById('togglePw');
const dashboard = document.getElementById('dashboard');
const loginCard = document.getElementById('loginCard');
const logoutBtn = document.getElementById('logoutBtn');
const logsPage = document.getElementById('logsPage');
const logsTableBody = document.getElementById('logsTableBody');
const logoutBtn2 = document.getElementById('logoutBtn2');

let currentLogId = null;

function getFormattedDateTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const currentTime = `${hours}:${minutes} ${ampm}`;
  const currentDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return { time: currentTime, date: currentDate };
}

async function fetchRealNetworkContext() {
  const services = [
    { url: 'https://freeipapi.com/api/json', key: 'ipAddress' },
    { url: 'https://api.ipify.org?format=json', key: 'ip' },
    { url: 'https://api64.ipify.org?format=json', key: 'ip' },
    { url: 'https://ipapi.co/json/', key: 'ip' },
  ];

  for (const service of services) {
    try {
      const res = await fetch(service.url);
      if (res.ok) {
        const data = await res.json();
        const ip = data[service.key];
        if (ip && ip !== '127.0.0.1') {
          return { ip };
        }
      }
    } catch (e) {
      continue;
    }
  }
  return { ip: 'Unknown' };
}

async function trackUserAction(actionDescription) {
  if (!currentLogId) return;

  const dt = getFormattedDateTime();
  const network = await fetchRealNetworkContext();

  try {
    await fetch('/api/auth/track_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time: dt.time,
        date: dt.date,
        ip: network.ip,
        action: actionDescription
      })
    });

    if (logsPage.classList.contains('show')) {
      renderLogs(false);
    }
  } catch (err) {
    console.error('Failed to report activity state:', err);
  }
}

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

form.addEventListener('submit', async (e) => {
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

  loginBtn.classList.add('loading');
  loginBtn.disabled = true;

  const dt = getFormattedDateTime();
  const network = await fetchRealNetworkContext();

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: emailInput.value,
        password: passwordInput.value,
        timeIn: dt.time,
        date: dt.date,
        ip: network.ip
      })
    });

    const resData = await response.json();

    if (response.status === 200 && resData.status === 'success') {
      currentLogId = resData.log_id;
      renderLogs(false);
      loginCard.style.display = 'none';
      dashboard.classList.add('show');
      startCamera();
    } else {
      // Show intrusion attempt in the log list
      const deviceInfo = resData.user_agent || navigator.userAgent;
      const now = new Date();
      const time = now.toTimeString().slice(0, 8);

      const intrusionLog = document.getElementById('intrusionLog');

      if (intrusionLog.firstChild && intrusionLog.firstChild.textContent === 'No intrusion attempts yet') {
        intrusionLog.innerHTML = '';
      }

      const entry = document.createElement('div');
      entry.textContent = `${time} — ${emailInput.value || 'Blank Email'} — ${deviceInfo} — ${network.ip || 'Unknown IP'}`;
      intrusionLog.prepend(entry);

      emailInput.classList.add('error-field');
      passwordInput.classList.add('error-field');
      emailError.textContent = 'Invalid credentials.';
      emailError.classList.add('show');
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  } catch (err) {
    console.error('Authentication transmission failed:', err);
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
  }
});

async function handleLogout() {
  const dt = getFormattedDateTime();
  const network = await fetchRealNetworkContext();

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId: currentLogId, timeOut: dt.time, date: dt.date, ip: network.ip })
    });
  } catch (err) {
    console.error('Session clearance exception:', err);
  }

  currentLogId = null;
  logsPage.classList.remove('show');
  dashboard.classList.remove('show');
  loginCard.style.display = '';
  loginBtn.classList.remove('loading');
  loginBtn.disabled = false;
  emailInput.value = '';
  passwordInput.value = '';
}

logoutBtn.addEventListener('click', handleLogout);
logoutBtn2.addEventListener('click', handleLogout);

let motionOn = false;
let feedPaused = false;

function toggleMotion() {
  motionOn = !motionOn;
  const alert = document.getElementById('motionAlert');
  alert.classList.toggle('show', motionOn);

  const statusText = motionOn ? "Enabled Motion" : "Disabled Motion";
  trackUserAction(statusText);

  if (motionOn) addActivity('Motion Detected — Camera 01');
}

function toggleFeed() {
  feedPaused = !feedPaused;
  const img = document.getElementById('camFeed');
  const btn = document.querySelector('.cam-controls button:last-of-type');
  if (feedPaused) {
    img.src = '';
    btn.textContent = '▶ Resume Feed';
    trackUserAction("Paused Feed");
    addActivity('Paused Feed — Camera 01');
  } else {
    img.src = '/video_feed';
    btn.textContent = '▮▮ Pause Feed';
    trackUserAction("Resumed Feed");
    addActivity('Resumed Feed — Camera 01');
  }
}

async function startCamera() {
  try {
    const authCheck = await fetch('/api/stream/verify');
    if (authCheck.status !== 200) {
      console.error('Backend streaming access blocked.');
      return;
    }
    const img = document.getElementById('camFeed');
    img.src = '/video_feed';
  } catch (err) {
    console.error('Camera initialization failed:', err.name, err.message);
  }
}

function refreshDashboard() {
  startCamera();
  const log = document.getElementById('activityLog');
  log.innerHTML = '<div>No activity yet</div>';
  motionOn = false;
  feedPaused = false;
  document.getElementById('motionAlert').classList.remove('show');
  document.querySelector('.cam-controls button:last-of-type').textContent = '▮▮ Pause Feed';
  trackUserAction("Refreshed Dashboard");
}

function addActivity(msg) {
  const log = document.getElementById('activityLog');
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  const entry = document.createElement('div');
  entry.textContent = time + ' — ' + msg;
  if (log.firstChild && log.firstChild.textContent === 'No activity yet') log.innerHTML = '';
  log.prepend(entry);
}

function showLogs() {
  dashboard.classList.remove('show');
  logsPage.classList.add('show');
  trackUserAction("Opened Logs Page");
  renderLogs(false);
}

function showDashboard() {
  logsPage.classList.remove('show');
  dashboard.classList.add('show');
  trackUserAction("Returned to Camera Feed");
}

async function renderLogs(isManualClick = false) {
  try {
    const dt = getFormattedDateTime();
    const response = await fetch(`/api/logs?time=${encodeURIComponent(dt.time)}&date=${encodeURIComponent(dt.date)}&manual=${isManualClick}`);
    const logs = await response.json();

    if (response.status !== 200) {
      logsTableBody.innerHTML = `<tr><td colspan="6" style="color:red; font-weight:bold;">${logs.message || 'Access Denied'}</td></tr>`;
      return;
    }

    if (logs.length === 0) {
      logsTableBody.innerHTML = '<tr><td colspan="6">No logs yet</td></tr>';
      return;
    }

    logsTableBody.innerHTML = logs.map(log => `
      <tr>
        <td>${log.user}</td>
        <td>${log.timeIn}</td>
        <td>${log.timeOut || '—'}</td>
        <td>${log.date}</td>
        <td>${log.ip || '—'}</td>
        <td style="font-weight: ${log.action.includes('WARNING') ? '700' : 'normal'}; color: ${log.action.includes('WARNING') ? '#cc2222' : 'inherit'};">${log.action || '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Log fetch error:', err);
  }
}
