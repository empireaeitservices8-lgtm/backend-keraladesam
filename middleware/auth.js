const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mysqlService = require('../services/mysqlService');

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWTSecretKey || 'secretkey123';

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
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = process.env.DB_TYPE === 'mysql'
      ? await mysqlService.getUserById(decoded.id)
      : await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found with this token',
      });
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
