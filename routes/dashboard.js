const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/stats', auth, async (req, res) => {
  try {
    const userProjects = await Project.find({ members: req.user._id }).select('_id name');
    const projectIds = userProjects.map(p => p._id);

    const statusCounts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = { todo: 0, 'in-progress': 0, done: 0, total: 0 };
    statusCounts.forEach(sc => { stats[sc._id] = sc.count; stats.total += sc.count; });

    const overdueCount = await Task.countDocuments({
      project: { $in: projectIds }, dueDate: { $lt: new Date() }, status: { $ne: 'done' }
    });
    stats.overdue = overdueCount;

    const myTasksCount = await Task.countDocuments({ assignee: req.user._id, status: { $ne: 'done' } });
    stats.myTasks = myTasksCount;

    const recentTasks = await Task.find({ project: { $in: projectIds } })
      .populate('assignee', 'name email').populate('project', 'name')
      .sort({ createdAt: -1 }).limit(10);

    const overdueTasks = await Task.find({
      project: { $in: projectIds }, dueDate: { $lt: new Date() }, status: { $ne: 'done' }
    }).populate('assignee', 'name email').populate('project', 'name').sort({ dueDate: 1 }).limit(10);

    const projectStats = await Promise.all(userProjects.map(async (p) => {
      const counts = await Task.aggregate([
        { $match: { project: p._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const pc = { todo: 0, 'in-progress': 0, done: 0, total: 0 };
      counts.forEach(c => { pc[c._id] = c.count; pc.total += c.count; });
      const progress = pc.total > 0 ? Math.round((pc.done / pc.total) * 100) : 0;
      return { _id: p._id, name: p.name, counts: pc, progress };
    }));

    res.json({ stats, recentTasks, overdueTasks, projectStats, projectCount: userProjects.length });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
