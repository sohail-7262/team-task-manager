const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// GET /api/projects — List user's projects
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({ members: req.user._id })
      .populate('owner', 'name email role')
      .populate('members', 'name email role')
      .sort({ createdAt: -1 });

    // Attach task counts to each project
    const projectsWithCounts = await Promise.all(projects.map(async (project) => {
      const taskCounts = await Task.aggregate([
        { $match: { project: project._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const counts = { todo: 0, 'in-progress': 0, done: 0, total: 0 };
      taskCounts.forEach(tc => {
        counts[tc._id] = tc.count;
        counts.total += tc.count;
      });
      return { ...project.toObject(), taskCounts: counts };
    }));

    res.json({ projects: projectsWithCounts });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/projects — Create project (Admin only)
router.post('/', auth, requireRole('admin'), [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Project name must be 2-100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description max 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, description } = req.body;
    const project = new Project({
      name,
      description: description || '',
      owner: req.user._id,
      members: [req.user._id]
    });
    await project.save();
    await project.populate('owner', 'name email role');
    await project.populate('members', 'name email role');

    res.status(201).json({ message: 'Project created!', project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/projects/:id — Get project details
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email role')
      .populate('members', 'name email role');

    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Check membership
    if (!project.members.some(m => m._id.equals(req.user._id))) {
      return res.status(403).json({ message: 'You are not a member of this project.' });
    }

    const tasks = await Task.find({ project: project._id })
      .populate('assignee', 'name email')
      .populate('creator', 'name email')
      .sort({ createdAt: -1 });

    res.json({ project, tasks });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/projects/:id — Update project (Admin owner only)
router.put('/:id', auth, requireRole('admin'), [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Project name must be 2-100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description max 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the project owner can update it.' });
    }

    const { name, description } = req.body;
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    await project.save();

    await project.populate('owner', 'name email role');
    await project.populate('members', 'name email role');

    res.json({ message: 'Project updated!', project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/projects/:id — Delete project (Admin owner only)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the project owner can delete it.' });
    }

    // Delete all tasks in the project
    await Task.deleteMany({ project: project._id });
    await Project.findByIdAndDelete(project._id);

    res.json({ message: 'Project and all its tasks deleted.' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/projects/:id/members — Add member by email (Admin owner only)
router.post('/:id/members', auth, requireRole('admin'), [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the project owner can add members.' });
    }

    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: 'No user found with that email.' });
    }

    if (project.members.some(m => m.equals(user._id))) {
      return res.status(400).json({ message: 'User is already a member of this project.' });
    }

    project.members.push(user._id);
    await project.save();
    await project.populate('members', 'name email role');

    res.json({ message: `${user.name} added to project!`, project });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/projects/:id/members/:userId — Remove member (Admin owner only)
router.delete('/:id/members/:userId', auth, requireRole('admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the project owner can remove members.' });
    }
    if (project.owner.equals(req.params.userId)) {
      return res.status(400).json({ message: 'Cannot remove the project owner.' });
    }

    project.members = project.members.filter(m => !m.equals(req.params.userId));
    await project.save();

    // Unassign removed user from tasks in this project
    await Task.updateMany(
      { project: project._id, assignee: req.params.userId },
      { assignee: null }
    );

    await project.populate('members', 'name email role');
    res.json({ message: 'Member removed.', project });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
