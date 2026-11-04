const app = require('../server');

module.exports = (req, res) => {
  const origin = req.headers.origin || 'https://kerala-dhesam.vercel.app';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin, Range, X-CSRF-Token, X-Api-Version'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Immediately respond to preflight OPTIONS in 0ms without waiting for downstream Express or DB
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return app(req, res);
};
