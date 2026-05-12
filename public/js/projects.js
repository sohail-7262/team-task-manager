if (!requireAuth()) window.location.href = '/';
let currentMembersProjectId = null;

document.addEventListener('DOMContentLoaded', () => {
  setupSidebar('projects');
  setupMobileMenu();
  if (isAdmin()) document.getElementById('createProjectBtn').style.display = '';
  loadProjects();
});

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

async function loadProjects() {
  try {
    const data = await api('/projects');
    const el = document.getElementById('projectsList');
    if (!data.projects.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">📁</div><h3>No projects yet</h3><p>${isAdmin() ? 'Create your first project' : 'Ask an admin to add you to a project'}</p></div>`;
      return;
    }
    el.innerHTML = '<div class="grid-3">' + data.projects.map(p => {
      const progress = p.taskCounts.total > 0 ? Math.round((p.taskCounts.done / p.taskCounts.total) * 100) : 0;
      const avatars = (p.members || []).slice(0, 4).map(m => `<div class="avatar" title="${esc(m.name)}">${getInitials(m.name)}</div>`).join('') +
        (p.members.length > 4 ? `<div class="avatar">+${p.members.length - 4}</div>` : '');
      return `<div class="project-card">
        <div class="project-name">${esc(p.name)}</div>
        <div class="project-desc">${esc(p.description) || 'No description'}</div>
        <div class="project-meta">
          <div class="member-avatars">${avatars}</div>
          <span style="font-size:12px;color:var(--text-muted)">📋 ${p.taskCounts.total}</span>
        </div>
        <div class="progress-bar"><div class="fill" style="width:${progress}%"></div></div>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="window.location.href='/tasks.html?project=${p._id}'">View Tasks</button>
          ${isAdmin() && p.owner && p.owner._id === getUser().id ? `
            <button class="btn btn-secondary btn-sm" onclick="openMembersModal('${p._id}')">👥 Members</button>
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${p._id}','${esc(p.name).replace(/'/g,"\\'")}','${esc(p.description).replace(/'/g,"\\'")}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProject('${p._id}')">🗑</button>` : ''}
        </div>
      </div>`;
    }).join('') + '</div>';
  } catch (err) { showToast(err.message, 'error'); }
}

function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'New Project';
  document.getElementById('projId').value = '';
  document.getElementById('projName').value = '';
  document.getElementById('projDesc').value = '';
  document.getElementById('projSubmitBtn').textContent = 'Create';
  document.getElementById('projectModal').classList.add('show');
}

function openEditModal(id, name, desc) {
  document.getElementById('modalTitle').textContent = 'Edit Project';
  document.getElementById('projId').value = id;
  document.getElementById('projName').value = name;
  document.getElementById('projDesc').value = desc;
  document.getElementById('projSubmitBtn').textContent = 'Update';
  document.getElementById('projectModal').classList.add('show');
}

function closeModal() { document.getElementById('projectModal').classList.remove('show'); }

async function handleProjectSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('projId').value;
  const body = { name: document.getElementById('projName').value, description: document.getElementById('projDesc').value };
  try {
    if (id) {
      await api(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Project updated!');
    } else {
      await api('/projects', { method: 'POST', body: JSON.stringify(body) });
      showToast('Project created!');
    }
    closeModal();
    loadProjects();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteProject(id) {
  if (!confirm('Delete this project and all its tasks?')) return;
  try {
    await api(`/projects/${id}`, { method: 'DELETE' });
    showToast('Project deleted');
    loadProjects();
  } catch (err) { showToast(err.message, 'error'); }
}

async function openMembersModal(projectId) {
  currentMembersProjectId = projectId;
  document.getElementById('membersModal').classList.add('show');
  try {
    const data = await api(`/projects/${projectId}`);
    const list = document.getElementById('membersList');
    const ownerId = data.project.owner._id || data.project.owner;
    list.innerHTML = data.project.members.map(m => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="user-avatar" style="width:32px;height:32px;font-size:12px">${getInitials(m.name)}</div>
          <div><div style="font-size:14px;font-weight:600">${esc(m.name)}</div><div style="font-size:12px;color:var(--text-muted)">${m.email} • ${m.role}</div></div>
        </div>
        ${m._id !== ownerId ? `<button class="btn btn-danger btn-sm" onclick="removeMember('${m._id}')">Remove</button>` : '<span class="badge badge-done">Owner</span>'}
      </div>`).join('');
  } catch (err) { showToast(err.message, 'error'); }
}

function closeMembersModal() { document.getElementById('membersModal').classList.remove('show'); currentMembersProjectId = null; }

async function handleAddMember(e) {
  e.preventDefault();
  const email = document.getElementById('memberEmail').value;
  try {
    await api(`/projects/${currentMembersProjectId}/members`, { method: 'POST', body: JSON.stringify({ email }) });
    showToast('Member added!');
    document.getElementById('memberEmail').value = '';
    openMembersModal(currentMembersProjectId);
    loadProjects();
  } catch (err) { showToast(err.message, 'error'); }
}

async function removeMember(userId) {
  if (!confirm('Remove this member?')) return;
  try {
    await api(`/projects/${currentMembersProjectId}/members/${userId}`, { method: 'DELETE' });
    showToast('Member removed');
    openMembersModal(currentMembersProjectId);
    loadProjects();
  } catch (err) { showToast(err.message, 'error'); }
}
