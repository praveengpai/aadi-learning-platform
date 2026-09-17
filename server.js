const express = require('express');
const cors = require('cors');
const sequelize = require('./db');
const { router: authRouter } = require('./auth');
const apiRoutes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Aadi Smart Learning Platform — server is running.');
});

app.use('/api/auth', authRouter);
app.use('/api', apiRoutes);

const port = process.env.PORT || 3000;

sequelize.sync().then(() => {
  app.listen(port, () => console.log(`Server listening on port ${port}`));
}).catch(err => console.error('Database connection failed:', err));
