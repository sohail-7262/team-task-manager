const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/tasks — List tasks with filters
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};

    // Filter by project
    if (req.query.project) {
      filter.project = req.query.project;
    }

    // Filter by status
    if (req.query.status && ['todo', 'in-progress', 'done'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    // Filter by priority
    if (req.query.priority && ['low', 'medium', 'high'].includes(req.query.priority)) {
      filter.priority = req.query.priority;
    }

    // Filter by assignee
    if (req.query.assignee) {
      filter.assignee = req.query.assignee;
    }

    // If not admin, only show tasks from user's projects
    const userProjects = await Project.find({ members: req.user._id }).select('_id');
    const projectIds = userProjects.map(p => p._id);

    if (!filter.project) {
      filter.project = { $in: projectIds };
    } else {
      // Verify user has access to the filtered project
      if (!projectIds.some(pid => pid.equals(filter.project))) {
        return res.status(403).json({ message: 'You do not have access to this project.' });
      }
    }

    const tasks = await Task.find(filter)
      .populate('assignee', 'name email')
      .populate('creator', 'name email')
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/tasks — Create task
router.post('/', auth, [
  body('title').trim().isLength({ min: 2, max: 150 }).withMessage('Title must be 2-150 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description max 1000 characters'),
  body('project').isMongoId().withMessage('Valid project ID is required'),
  body('assignee').optional({ values: 'null' }).isMongoId().withMessage('Valid assignee ID is required'),
  body('status').optional().isIn(['todo', 'in-progress', 'done']).withMessage('Invalid status'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('dueDate').optional({ values: 'null' }).isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { title, description, project, assignee, status, priority, dueDate } = req.body;

    // Verify project exists and user is a member
    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!projectDoc.members.some(m => m.equals(req.user._id))) {
      return res.status(403).json({ message: 'You are not a member of this project.' });
    }

    // Verify assignee is a project member (if provided)
    if (assignee) {
      if (!projectDoc.members.some(m => m.equals(assignee))) {
        return res.status(400).json({ message: 'Assignee must be a project member.' });
      }
    }

    const task = new Task({
      title,
      description: description || '',
      project,
      assignee: assignee || null,
      creator: req.user._id,
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate: dueDate || null
    });
    await task.save();

    await task.populate('assignee', 'name email');
    await task.populate('creator', 'name email');
    await task.populate('project', 'name');

    res.status(201).json({ message: 'Task created!', task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/tasks/:id — Get single task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email')
      .populate('creator', 'name email')
      .populate('project', 'name members');

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Check user has access to the project
    const project = await Project.findById(task.project._id || task.project);
    if (!project.members.some(m => m.equals(req.user._id))) {
      return res.status(403).json({ message: 'You do not have access to this task.' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/tasks/:id — Update task (Admin or task creator)
router.put('/:id', auth, [
  body('title').optional().trim().isLength({ min: 2, max: 150 }).withMessage('Title must be 2-150 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description max 1000 characters'),
  body('assignee').optional({ values: 'null' }).isMongoId().withMessage('Valid assignee ID is required'),
  body('status').optional().isIn(['todo', 'in-progress', 'done']).withMessage('Invalid status'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('dueDate').optional({ values: 'null' }).isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Only admin or task creator can fully update
    if (req.user.role !== 'admin' && !task.creator.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only admin or task creator can update this task.' });
    }

    const { title, description, assignee, status, priority, dueDate } = req.body;

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (assignee !== undefined) task.assignee = assignee || null;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate || null;

    await task.save();
    await task.populate('assignee', 'name email');
    await task.populate('creator', 'name email');
    await task.populate('project', 'name');

    res.json({ message: 'Task updated!', task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PATCH /api/tasks/:id/status — Update status only (assignee or admin)
router.patch('/:id/status', auth, [
  body('status').isIn(['todo', 'in-progress', 'done']).withMessage('Status must be todo, in-progress, or done')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Assignee, creator, or admin can update status
    const canUpdate = req.user.role === 'admin' ||
      task.creator.equals(req.user._id) ||
      (task.assignee && task.assignee.equals(req.user._id));

    if (!canUpdate) {
      return res.status(403).json({ message: 'You can only update status of tasks assigned to you.' });
    }

    task.status = req.body.status;
    await task.save();

    await task.populate('assignee', 'name email');
    await task.populate('creator', 'name email');
    await task.populate('project', 'name');

    res.json({ message: 'Status updated!', task });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/tasks/:id — Delete task (Admin or creator)
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if (req.user.role !== 'admin' && !task.creator.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only admin or task creator can delete this task.' });
    }

    await Task.findByIdAndDelete(task._id);
    res.json({ message: 'Task deleted.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
