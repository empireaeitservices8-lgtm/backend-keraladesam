const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const isMySQL = process.env.DB_TYPE === 'mysql';

if (isMySQL) {
  const { initMySQLTables } = require('./config/mysql');
  initMySQLTables()
    .then(() => console.log('MySQL Database and Tables initialized successfully'))
    .catch((err) => console.error('MySQL initialization warning:', err.message));
} else {
  const connectDB = require('./config/db');
  connectDB();
}

const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Admin UI Web Application Route - redirects to modern Next.js Admin Portal
app.get(['/admin', '/login'], (req, res) => {
  res.redirect(302, 'https://kerala-dhesam.vercel.app/admin');
});

app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(200).json({
      status: 'online',
      service: 'Kerala Desam Backend & Admin API',
      version: '1.0.0',
      endpoints: {
        admin: 'https://kerala-dhesam.vercel.app/admin',
        health: '/api/health',
        articles: '/api/articles',
        breaking: '/api/breaking',
        videos: '/api/videos',
        auth: '/api/auth'
      }
    });
  }
  res.redirect(302, 'https://kerala-dhesam.vercel.app/admin');
});

// Ensure MongoDB connection for serverless invocations if not using MySQL
app.use(async (req, res, next) => {
  if (!isMySQL && req.path.startsWith('/api')) {
    try {
      const connectDB = require('./config/db');
      await connectDB();
    } catch (e) {
      console.error('Database connection error in request:', e.message);
    }
  }
  next();
});

app.get('/api/health', (req, res) => {
  if (isMySQL) {
    return res.json({
      status: 'ok',
      database: 'mysql',
      service: 'Kerala Desam API',
      timestamp: new Date().toISOString(),
    });
  }

  const mongoose = require('mongoose');
  res.json({
    status: mongoose.connection.readyState === 1 ? 'ok' : 'connecting',
    database: 'mongodb',
    service: 'Kerala Desam API',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/articles', require('./routes/articleRoutes'));
app.use('/api/breaking', require('./routes/breakingRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/forex', require('./routes/forexRoutes'));
app.use('/api/tts', require('./routes/ttsRoutes'));
app.use('/api/seed', require('./routes/seedRoutes'));
app.use('/api/subscribers', require('./routes/subscriberRoutes'));
app.use('/api/ads', require('./routes/adRoutes'));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Kerala Desam server running on port ${PORT}`);
  });
}

module.exports = app;

