const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey123';

const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role === 'admin' ? 'admin' : 'editor',
    });

    sendTokenResponse(user, 201, res, 'Registration successful');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail }).select('+password');

    // Auto-create default admin account on-demand if it doesn't exist
    if (!user) {
      if (cleanEmail === 'admin@keraladesam.com' && (password === 'admin12345' || password === 'password123')) {
        user = await User.create({
          name: 'ചീഫ് എഡിറ്റർ',
          email: 'admin@keraladesam.com',
          password: 'admin12345',
          role: 'admin',
          avatar: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
        });
        return sendTokenResponse(user, 200, res, 'Login successful');
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      // If logging in as admin with default password, allow and authenticate
      if (cleanEmail === 'admin@keraladesam.com' && (password === 'admin12345' || password === 'password123')) {
        return sendTokenResponse(user, 200, res, 'Login successful');
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    sendTokenResponse(user, 200, res, 'Login successful');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Login failed',
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user',
    });
  }
};
