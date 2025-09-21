const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user || user.isActive === false) {
      return next(new ErrorResponse('User not found or deactivated', 401));
    }

    req.user = user;

    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(`User role ${req.user ? req.user.role : 'guest'} is not authorized to access this route`, 403)
      );
    }
    next();
  };
};

// Optional authentication: sets req.user if token is present and valid, otherwise continues without error
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return next();
    }
    const token = auth.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive !== false) {
      req.user = user;
    }
  } catch (e) {
    // ignore invalid tokens for optional auth
  }
  return next();
});