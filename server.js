const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { initMySQLTables } = require('./config/mysql');

const isCloudHosting = Boolean(process.env.VERCEL || process.env.RENDER);
const hasExternalDb = Boolean(
  process.env.DB_HOST &&
    process.env.DB_HOST !== '127.0.0.1' &&
    process.env.DB_HOST !== 'localhost'
);

// Always initialize MySQL database & schema safely (non-blocking for serverless/containers)
if (!isCloudHosting || hasExternalDb) {
  initMySQLTables()
    .then(() => console.log('✅ MySQL Database and Tables initialized successfully'))
    .catch((err) => console.error('❌ MySQL initialization warning:', err.message));
} else {
  console.log('ℹ️ Running in cloud environment without external DB_HOST configured; using resilient auth/content layer.');
}

const app = express();

const ALLOWED_ORIGIN_PATTERNS = [
  'https://kerala-dhesam.vercel.app',
  'https://kerala-dhesam-admin.vercel.app',
  'https://kerala-dhesam.onrender.com',
  'https://kerala-dhesam-admin.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
];

// Helper to determine active frontend base URL dynamically
const getFrontendUrl = (req) => {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, '');
  const host = (req && req.headers && req.headers.host) || '';
  if (host.includes('onrender.com')) {
    return 'https://kerala-dhesam.onrender.com';
  }
  return 'https://kerala-dhesam.vercel.app';
};

// Comprehensive CORS & Preflight handler
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!res.getHeader('Access-Control-Allow-Origin')) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }

  if (!res.getHeader('Access-Control-Allow-Methods')) {
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
    );
  }
  if (!res.getHeader('Access-Control-Allow-Headers')) {
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, Range, X-CSRF-Token, X-Api-Version'
    );
  }
  if (!res.getHeader('Access-Control-Expose-Headers')) {
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
  }
  if (!res.getHeader('Access-Control-Max-Age')) {
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Admin UI Web Application Route - redirects to modern Next.js Admin Portal
app.get(['/admin', '/login'], (req, res) => {
  res.redirect(302, `${getFrontendUrl(req)}/admin`);
});

app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(200).json({
      status: 'online',
      service: 'Kerala Desam Backend & Admin API',
      database: 'mysql',
      version: '1.0.0',
      endpoints: {
        admin: `${getFrontendUrl(req)}/admin`,
        health: '/api/health',
        articles: '/api/articles',
        breaking: '/api/breaking',
        videos: '/api/videos',
        auth: '/api/auth'
      }
    });
  }
  res.redirect(302, `${getFrontendUrl(req)}/admin`);
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
app.use('/api/upload', require('./routes/cloudflareRoutes'));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled express error:', err.stack);
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.HOST || '0.0.0.0';
  const server = app.listen(PORT, HOST, () => {
    console.log(`Kerala Desam server running on http://${HOST}:${PORT} with MySQL`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${PORT} on ${HOST} is in use. Retrying on port ${Number(PORT) + 1}...`);
      app.listen(Number(PORT) + 1, HOST, () => {
        console.log(`Kerala Desam server running on http://${HOST}:${Number(PORT) + 1} with MySQL`);
      });
    } else {
      console.error('❌ Server startup error:', err);
    }
  });
}

module.exports = app;
