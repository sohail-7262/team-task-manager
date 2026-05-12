// ═══ API Helper Module ═══
const API_BASE = '/api';

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function removeToken() { localStorage.removeItem('token'); localStorage.removeItem('user'); }
function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } }
function setUser(u) { localStorage.setItem('user', JSON.stringify(u)); }
function isAdmin() { const u = getUser(); return u && u.role === 'admin'; }

async function api(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  
  if (res.status === 401) {
    removeToken();
    window.location.href = '/';
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function requireAuth() {
  if (!getToken()) { window.location.href = '/'; return false; }
  return true;
}

function redirectIfAuth() {
  if (getToken()) { window.location.href = '/dashboard.html'; return true; }
  return false;
}

// Toast notifications
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Format date
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate, status) {
  if (!dueDate || status === 'done') return false;
  return new Date() > new Date(dueDate);
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Sidebar setup (reused across pages)
function setupSidebar(activePage) {
  const user = getUser();
  if (!user) return;
  
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  sidebar.innerHTML = `
    <div class="brand">TaskFlow</div>
    <ul class="nav-links">
      <li><a href="/dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}"><span class="icon">📊</span> Dashboard</a></li>
      <li><a href="/projects.html" class="${activePage === 'projects' ? 'active' : ''}"><span class="icon">📁</span> Projects</a></li>
      <li><a href="/tasks.html" class="${activePage === 'tasks' ? 'active' : ''}"><span class="icon">✅</span> Tasks</a></li>
    </ul>
    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">${getInitials(user.name)}</div>
        <div class="user-details">
          <div class="name">${user.name}</div>
          <div class="role">${user.role}</div>
        </div>
      </div>
      <button class="logout-btn" onclick="handleLogout()">⎋ Sign Out</button>
    </div>`;
}

function handleLogout() {
  removeToken();
  window.location.href = '/';
}

// Mobile menu
function setupMobileMenu() {
  const toggle = document.querySelector('.mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) sidebar.classList.remove('open');
    });
  }
}
