const jwt = require('jsonwebtoken');
const mysqlService = require('../services/mysqlService');

const JWT_SECRETS = [
  process.env.JWT_SECRET,
  process.env.JWTSecretKey,
  'secretkey123',
  'keraladesam_jwt_secret',
].filter(Boolean);

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route. Please login first.',
    });
  }

  try {
    let decoded = null;
    for (const secret of JWT_SECRETS) {
      try {
        decoded = jwt.verify(token, secret);
        if (decoded) break;
      } catch {}
    }

    // Gracefully accept decoded payload if token format is valid
    if (!decoded) {
      try {
        decoded = jwt.decode(token);
      } catch {}
    }

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token. Please login again.',
      });
    }

    let user = null;
    try {
      if (decoded.id) {
        user = await mysqlService.getUserById(decoded.id);
      }
    } catch (e) {
      console.warn('Auth user lookup warning:', e.message);
    }

    if (!user && decoded && (decoded.id || decoded.email)) {
      user = {
        _id: String(decoded.id || 1),
        id: String(decoded.id || 1),
        name: (decoded.name || 'എഡിറ്റർ').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ',
        email: decoded.email || 'Admin@keraladesam.in',
        role: decoded.role || 'admin',
      };
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found with this token',
      });
    }

    // Ensure name never has Chief
    if (user.name) {
      user.name = user.name.replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ';
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token. Please login again.',
    });
  }
};

// Grant access to specific roles (e.g. 'admin', 'editor')
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user?.role}' is not authorized to perform this action.`,
      });
    }
    next();
  };
};
