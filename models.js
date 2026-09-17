const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Center = sequelize.define('Center', {
  name: { type: DataTypes.STRING, allowNull: false },
  settlement: DataTypes.STRING,
  district: DataTypes.STRING,
});

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'teacher', 'student'), allowNull: false },
  classGroup: DataTypes.STRING, // e.g. "Class 1-7", "Class 8-12", "Youth"
  phone: DataTypes.STRING,
  smartphoneAccess: { type: DataTypes.BOOLEAN, defaultValue: false },
});

const Attendance = sequelize.define('Attendance', {
  date: { type: DataTypes.DATEONLY, allowNull: false },
  present: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const Assessment = sequelize.define('Assessment', {
  date: { type: DataTypes.DATEONLY, allowNull: false },
  subject: DataTypes.STRING,
  score: DataTypes.FLOAT,
  maxScore: DataTypes.FLOAT,
  remarks: DataTypes.TEXT,
});

const ProgressNote = sequelize.define('ProgressNote', {
  month: DataTypes.INTEGER,
  year: DataTypes.INTEGER,
  summary: DataTypes.TEXT,
});

// Associations
Center.hasMany(User, { foreignKey: 'centerId' });
User.belongsTo(Center, { foreignKey: 'centerId' });

User.hasMany(Attendance, { as: 'attendanceRecords', foreignKey: 'studentId' });
Attendance.belongsTo(User, { as: 'student', foreignKey: 'studentId' });
Attendance.belongsTo(User, { as: 'markedByUser', foreignKey: 'markedBy' });

User.hasMany(Assessment, { as: 'assessments', foreignKey: 'studentId' });
Assessment.belongsTo(User, { as: 'student', foreignKey: 'studentId' });
Assessment.belongsTo(User, { as: 'recordedByUser', foreignKey: 'recordedBy' });

User.hasMany(ProgressNote, { as: 'progressNotes', foreignKey: 'studentId' });
ProgressNote.belongsTo(User, { as: 'student', foreignKey: 'studentId' });
ProgressNote.belongsTo(User, { as: 'recordedByUser', foreignKey: 'recordedBy' });

module.exports = { sequelize, Center, User, Attendance, Assessment, ProgressNote };
