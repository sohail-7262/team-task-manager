if (!requireAuth()) window.location.href = '/';

document.addEventListener('DOMContentLoaded', () => {
  setupSidebar('dashboard');
  setupMobileMenu();
  const user = getUser();
  if (user) document.getElementById('userName').textContent = user.name;
  loadDashboard();
});

async function loadDashboard() {
  try {
    const data = await api('/dashboard/stats');
    const s = data.stats;

    document.getElementById('totalTasks').textContent = s.total;
    document.getElementById('inProgress').textContent = s['in-progress'];
    document.getElementById('completed').textContent = s.done;
    document.getElementById('overdue').textContent = s.overdue;

    // Recent tasks
    const rt = document.getElementById('recentTasks');
    if (!data.recentTasks.length) {
      rt.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h3>No tasks yet</h3><p>Create a project and start adding tasks</p></div>';
    } else {
      rt.innerHTML = '<div class="table-container"><table><thead><tr><th>Task</th><th>Project</th><th>Status</th><th>Due</th></tr></thead><tbody>' +
        data.recentTasks.map(t => {
          const od = isOverdue(t.dueDate, t.status);
          return `<tr>
            <td style="font-weight:600">${esc(t.title)}</td>
            <td>${t.project ? esc(t.project.name) : '—'}</td>
            <td><span class="badge badge-${t.status}">${t.status}</span></td>
            <td class="${od ? 'overdue' : ''}">${formatDate(t.dueDate)}${od ? ' ⚠️' : ''}</td>
          </tr>`;
        }).join('') + '</tbody></table></div>';
    }

    // Overdue tasks
    const ot = document.getElementById('overdueTasks');
    if (!data.overdueTasks.length) {
      ot.innerHTML = '<div class="empty-state"><div class="icon">🎉</div><h3>No overdue tasks</h3><p>Great job staying on track!</p></div>';
    } else {
      ot.innerHTML = data.overdueTasks.map(t => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-weight:600;font-size:14px">${esc(t.title)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${t.project ? esc(t.project.name) : ''} • ${t.assignee ? esc(t.assignee.name) : 'Unassigned'}</div>
          </div>
          <span class="badge badge-overdue">Due ${formatDate(t.dueDate)}</span>
        </div>`).join('');
    }

    // Project progress
    const pp = document.getElementById('projectProgress');
    if (!data.projectStats.length) {
      pp.innerHTML = '<div class="empty-state"><div class="icon">📁</div><h3>No projects</h3><p>Create your first project to get started</p></div>';
    } else {
      pp.innerHTML = '<div class="grid-3">' + data.projectStats.map(p => `
        <div class="project-card" onclick="window.location.href='/tasks.html?project=${p._id}'">
          <div class="project-name">${esc(p.name)}</div>
          <div style="display:flex;gap:12px;margin:12px 0;font-size:12px;color:var(--text-muted)">
            <span>📋 ${p.counts.total}</span>
            <span>🔄 ${p.counts['in-progress']}</span>
            <span>✅ ${p.counts.done}</span>
          </div>
          <div class="progress-bar"><div class="fill" style="width:${p.progress}%"></div></div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${p.progress}% complete</div>
        </div>`).join('') + '</div>';
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
