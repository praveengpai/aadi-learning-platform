const express = require('express');
const { Center, User, Attendance, Assessment, ProgressNote } = require('./models');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();
router.use(requireAuth);

// Centers
router.get('/centers', async (req, res) => res.json(await Center.findAll()));
router.post('/centers', requireRole('admin'), async (req, res) => res.json(await Center.create(req.body)));

// Students
router.get('/students', requireRole('admin', 'teacher'), async (req, res) => {
  res.json(await User.findAll({ where: { role: 'student' }, attributes: { exclude: ['passwordHash'] } }));
});

// Attendance
router.post('/attendance', requireRole('admin', 'teacher'), async (req, res) => {
  const { studentId, date, present } = req.body;
  const record = await Attendance.create({ studentId, date, present, markedBy: req.user.id });
  res.json(record);
});
router.get('/attendance', requireRole('admin', 'teacher'), async (req, res) => {
  const { studentId } = req.query;
  res.json(await Attendance.findAll({ where: studentId ? { studentId } : {} }));
});

// Assessments (weekly Saturday tests)
router.post('/assessments', requireRole('admin', 'teacher'), async (req, res) => {
  const { studentId, date, subject, score, maxScore, remarks } = req.body;
  const record = await Assessment.create({ studentId, date, subject, score, maxScore, remarks, recordedBy: req.user.id });
  res.json(record);
});
router.get('/assessments', requireRole('admin', 'teacher'), async (req, res) => {
  const { studentId } = req.query;
  res.json(await Assessment.findAll({ where: studentId ? { studentId } : {} }));
});

// Monthly progress notes
router.post('/progress', requireRole('admin', 'teacher'), async (req, res) => {
  const { studentId, month, year, summary } = req.body;
  const record = await ProgressNote.create({ studentId, month, year, summary, recordedBy: req.user.id });
  res.json(record);
});
router.get('/progress', requireRole('admin', 'teacher'), async (req, res) => {
  const { studentId } = req.query;
  res.json(await ProgressNote.findAll({ where: studentId ? { studentId } : {} }));
});

module.exports = router;
