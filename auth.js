const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('./models');

const router = express.Router();
const SECRET = process.env.JWT_SECRET;

router.post('/register', async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    const isFirstUser = !existingAdmin;

    // Only an existing admin can create more users, EXCEPT the very first admin ever
    if (!isFirstUser) {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(403).json({ error: 'Admin auth required to create users' });
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, SECRET);
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Only admin can create users' });
    }

    const { name, email, password, role, classGroup, phone, smartphoneAccess, centerId } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, passwordHash,
      role: isFirstUser ? 'admin' : role,
      classGroup, phone, smartphoneAccess, centerId,
    });
    res.json({ id: user.id, name: user.name, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { router, requireAuth, requireRole };
