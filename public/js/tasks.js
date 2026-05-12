if (!requireAuth()) window.location.href = '/';
let allProjects = [];
let allTasks = [];

document.addEventListener('DOMContentLoaded', () => {
  setupSidebar('tasks');
  setupMobileMenu();
  loadProjectsFilter();
  loadTasks();
});

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

async function loadProjectsFilter() {
  try {
    const data = await api('/projects');
    allProjects = data.projects;
    const filterSel = document.getElementById('filterProject');
    const taskSel = document.getElementById('taskProject');
    allProjects.forEach(p => {
      filterSel.innerHTML += `<option value="${p._id}">${esc(p.name)}</option>`;
      taskSel.innerHTML += `<option value="${p._id}">${esc(p.name)}</option>`;
    });
    // Check URL param for project filter
    const urlProject = new URLSearchParams(window.location.search).get('project');
    if (urlProject) { filterSel.value = urlProject; loadTasks(); }
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadTasks() {
  try {
    let url = '/tasks?';
    const project = document.getElementById('filterProject').value;
    const priority = document.getElementById('filterPriority').value;
    if (project) url += `project=${project}&`;
    if (priority) url += `priority=${priority}&`;
    const data = await api(url);
    allTasks = data.tasks;
    renderKanban();
  } catch (err) { showToast(err.message, 'error'); }
}

function renderKanban() {
  const todo = allTasks.filter(t => t.status === 'todo');
  const prog = allTasks.filter(t => t.status === 'in-progress');
  const done = allTasks.filter(t => t.status === 'done');

  document.getElementById('countTodo').textContent = todo.length;
  document.getElementById('countProgress').textContent = prog.length;
  document.getElementById('countDone').textContent = done.length;

  document.getElementById('tasksTodo').innerHTML = todo.length ? todo.map(renderTaskCard).join('') : '<div class="empty-state" style="padding:24px"><p>No tasks</p></div>';
  document.getElementById('tasksProgress').innerHTML = prog.length ? prog.map(renderTaskCard).join('') : '<div class="empty-state" style="padding:24px"><p>No tasks</p></div>';
  document.getElementById('tasksDone').innerHTML = done.length ? done.map(renderTaskCard).join('') : '<div class="empty-state" style="padding:24px"><p>No tasks</p></div>';
}

function renderTaskCard(t) {
  const od = isOverdue(t.dueDate, t.status);
  const canEdit = isAdmin() || (getUser() && t.creator && t.creator._id === getUser().id);
  return `<div class="task-card" draggable="true" ondragstart="dragStart(event,'${t._id}')" id="task-${t._id}">
    <div class="task-title">${esc(t.title)}</div>
    ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
    <div class="task-meta">
      <span class="badge badge-${t.priority}">${t.priority}</span>
      ${t.dueDate ? `<span class="task-due ${od ? 'overdue' : ''}">${od ? '⚠️ ' : ''}${formatDate(t.dueDate)}</span>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
      <span class="task-assignee">👤 ${t.assignee ? esc(t.assignee.name) : 'Unassigned'}</span>
      <span style="font-size:11px;color:var(--text-muted)">${t.project ? esc(t.project.name) : ''}</span>
    </div>
    ${canEdit ? `<div style="display:flex;gap:6px;margin-top:10px">
      <button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px" onclick="openEditTask('${t._id}')">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" style="font-size:11px;padding:4px 10px" onclick="deleteTask('${t._id}')">🗑</button>
    </div>` : ''}
  </div>`;
}

// Drag & Drop
function dragStart(e, taskId) { e.dataTransfer.setData('text/plain', taskId); e.target.classList.add('dragging'); }
function allowDrop(e) { e.preventDefault(); }
async function handleDrop(e, newStatus) {
  e.preventDefault();
  const taskId = e.dataTransfer.getData('text/plain');
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('dragging'));
  try {
    await api(`/tasks/${taskId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    showToast('Status updated!');
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

// Task Modal
function openTaskModal() {
  document.getElementById('taskModalTitle').textContent = 'New Task';
  document.getElementById('taskId').value = '';
  document.getElementById('taskForm').reset();
  document.getElementById('taskSubmitBtn').textContent = 'Create';
  document.getElementById('taskStatusGroup').style.display = 'none';
  updateAssigneeOptions();
  document.getElementById('taskModal').classList.add('show');
}

async function openEditTask(taskId) {
  try {
    const data = await api(`/tasks/${taskId}`);
    const t = data.task;
    document.getElementById('taskModalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = t._id;
    document.getElementById('taskTitle').value = t.title;
    document.getElementById('taskDesc').value = t.description || '';
    document.getElementById('taskProject').value = t.project._id || t.project;
    document.getElementById('taskPriority').value = t.priority;
    document.getElementById('taskDue').value = t.dueDate ? t.dueDate.split('T')[0] : '';
    document.getElementById('taskStatusGroup').style.display = 'block';
    document.getElementById('taskStatus').value = t.status || 'todo';
    document.getElementById('taskSubmitBtn').textContent = 'Update';
    await updateAssigneeOptions();
    document.getElementById('taskAssignee').value = t.assignee ? (t.assignee._id || t.assignee) : '';
    document.getElementById('taskModal').classList.add('show');
  } catch (err) { showToast(err.message, 'error'); }
}

function closeTaskModal() { document.getElementById('taskModal').classList.remove('show'); }

async function updateAssigneeOptions() {
  const projId = document.getElementById('taskProject').value;
  const sel = document.getElementById('taskAssignee');
  sel.innerHTML = '<option value="">Unassigned</option>';
  if (!projId) return;
  const proj = allProjects.find(p => p._id === projId);
  if (proj && proj.members) {
    proj.members.forEach(m => { sel.innerHTML += `<option value="${m._id}">${esc(m.name)}</option>`; });
  }
}

document.getElementById('taskProject').addEventListener('change', updateAssigneeOptions);

async function handleTaskSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('taskId').value;
  const body = {
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDesc').value,
    project: document.getElementById('taskProject').value,
    assignee: document.getElementById('taskAssignee').value || null,
    priority: document.getElementById('taskPriority').value,
    dueDate: document.getElementById('taskDue').value || null
  };
  if (id) body.status = document.getElementById('taskStatus').value;
  try {
    if (id) {
      await api(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('Task updated!');
    } else {
      await api('/tasks', { method: 'POST', body: JSON.stringify(body) });
      showToast('Task created!');
    }
    closeTaskModal();
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    showToast('Task deleted');
    loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}
