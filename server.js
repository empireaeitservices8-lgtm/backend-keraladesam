const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Admin UI Web Application Route
app.get(['/', '/admin', '/login'], (req, res, next) => {
  // If API client explicitly requests JSON at root
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(200).json({
      status: 'online',
      service: 'Kerala Desam Backend & Admin API',
      version: '1.0.0',
      endpoints: {
        admin: '/',
        health: '/api/health',
        articles: '/api/articles',
        breaking: '/api/breaking',
        auth: '/api/auth'
      }
    });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: mongoose.connection.readyState === 1 ? 'ok' : 'connecting',
    service: 'Kerala Desam API',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/articles', require('./routes/articleRoutes'));
app.use('/api/breaking', require('./routes/breakingRoutes'));
app.use('/api/seed', require('./routes/seedRoutes'));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Kerala Desam server running on port ${PORT}`);
});

module.exports = app;

