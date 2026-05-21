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

// Helper function to force real public network credentials lookup
async function fetchRealNetworkContext() {
  let ip = '127.0.0.1';
  let location = 'Localhost System Admin';
  try {
    const res = await fetch('https://freeipapi.com/api/json');
    if (res.ok) {
      const data = await res.json();
      ip = data.ipAddress || ip;
      if (data.cityName && data.countryName) {
        location = `${data.cityName}, ${data.countryName}`;
      }
    }
  } catch(e) {
    console.warn("External lookup limits encountered, falling back securely.");
  }
  return { ip, location };
}

// Track each event step by step into its own unique, fresh line
async function trackUserAction(actionDescription) {
  if (!currentLogId) return; 

  const now = new Date();
  const currentTime = now.toTimeString().slice(0,8);
  const currentDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const network = await fetchRealNetworkContext();

  try {
    await fetch('/api/auth/track_action', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time: currentTime,
        date: currentDate,
        ip: network.ip,
        location: network.location,
        action: actionDescription 
      })
    });
    
    if (logsPage.classList.contains('show')) {
      renderLogs();
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

  const now = new Date();
  const currentLoginTime = now.toTimeString().slice(0,8);
  const currentLoginDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  const network = await fetchRealNetworkContext();

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: emailInput.value,
        password: passwordInput.value,
        timeIn: currentLoginTime,
        date: currentLoginDate,
        ip: network.ip,
        location: network.location
      })
    });

    const resData = await response.json();

    if (response.status === 200 && resData.status === 'success') {
      currentLogId = resData.log_id; 
      renderLogs();
      loginCard.style.display = 'none';
      dashboard.classList.add('show');
      startCamera();
    } else {
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
  const now = new Date();
  const timeOut = now.toTimeString().slice(0,8);
  const currentLoginDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const network = await fetchRealNetworkContext();

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId: currentLogId, timeOut: timeOut, date: currentLoginDate, ip: network.ip, location: network.location })
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
  const video = document.getElementById('camFeed');
  if (!video || !video.srcObject) return;
  feedPaused = !feedPaused;
  const btn = document.querySelector('.cam-controls button:last-of-type');
  if (feedPaused) {
    video.pause();
    btn.textContent = '▶ Resume Feed';
    trackUserAction("Paused Feed"); 
  } else {
    video.play();
    btn.textContent = '▮▮ Pause Feed';
    trackUserAction("Resumed Feed"); 
  }
}

async function startCamera() {
  try {
    const authCheck = await fetch('/api/stream/verify');
    if (authCheck.status !== 200) {
      console.error('Backend streaming access blocked.');
      return; 
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById('camFeed');
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
    };
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
  const time = now.toTimeString().slice(0,8);
  const entry = document.createElement('div');
  entry.textContent = time + ' — ' + msg;
  if (log.firstChild && log.firstChild.textContent === 'No activity yet') log.innerHTML = '';
  log.prepend(entry);
}

function showLogs() {
  dashboard.classList.remove('show');
  logsPage.classList.add('show');
  trackUserAction("Opened Logs Page"); 
  renderLogs();
}

function showDashboard() {
  logsPage.classList.remove('show');
  dashboard.classList.add('show');
  trackUserAction("Returned to Camera Feed");
}

async function renderLogs() {
  try {
    const response = await fetch('/api/logs');
    const logs = await response.json();

    if (response.status !== 200) {
      logsTableBody.innerHTML = `<tr><td colspan="7" style="color:red; font-weight:bold;">${logs.message || 'Access Denied'}</td></tr>`;
      return;
    }

    if (logs.length === 0) {
      logsTableBody.innerHTML = '<tr><td colspan="7">No logs yet</td></tr>';
      return;
    }

    logsTableBody.innerHTML = logs.map(log => `
      <tr>
        <td>${log.user}</td>
        <td>${log.timeIn}</td>
        <td>${log.timeOut || '—'}</td>
        <td>${log.date}</td>
        <td>${log.ip || '—'}</td>
        <td>${log.location || '—'}</td>
        <td style="font-weight: ${log.action.includes('WARNING') ? '700' : 'normal'}; color: ${log.action.includes('WARNING') ? '#cc2222' : 'inherit'};">${log.action || '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Log fetch error:', err);
  }
}