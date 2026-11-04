const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { initMySQLTables } = require('./config/mysql');

dotenv.config();

// Always initialize MySQL database & schema
initMySQLTables()
  .then(() => console.log('✅ MySQL Database and Tables initialized successfully'))
  .catch((err) => console.error('❌ MySQL initialization warning:', err.message));

const app = express();

// Comprehensive CORS & Preflight handler
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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
      database: 'mysql',
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

app.get('/api/health', (req, res) => {
  return res.json({
    status: 'ok',
    database: 'mysql',
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
app.use('/api/photo-story', require('./routes/photoStoryRoutes'));
app.use('/api/cloudflare', require('./routes/cloudflareRoutes'));

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
    console.log(`Kerala Desam server running on port ${PORT} with MySQL`);
  });
}

module.exports = app;
