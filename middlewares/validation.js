const { body, validationResult } = require('express-validator');
const ErrorResponse = require('../utils/errorResponse');

// Validation result handler
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return next(new ErrorResponse('Validation failed', 400, errorMessages));
  }
  next();
};

// Profile update validation
exports.validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
    
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
    
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
    
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
    
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Street address cannot exceed 100 characters'),
    
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('City can only contain letters and spaces'),
    
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('State can only contain letters and spaces'),
    
  body('address.zipCode')
    .optional()
    .trim()
    .matches(/^[0-9]{5}(-[0-9]{4})?$/)
    .withMessage('Please provide a valid ZIP code'),
    
  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Country can only contain letters and spaces'),
    
  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications preference must be a boolean'),
    
  body('preferences.newsletter')
    .optional()
    .isBoolean()
    .withMessage('Newsletter preference must be a boolean'),
    
  body('preferences.twoFactorAuth')
    .optional()
    .isBoolean()
    .withMessage('Two-factor authentication preference must be a boolean'),
];

// Password change validation
exports.validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
    
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
];

// Sanitize input data
exports.sanitizeInput = (req, res, next) => {
  // Remove any potentially dangerous characters
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<script[^>]*>.*?<\/script>/gi, '')
              .replace(/<[^>]*>/g, '')
              .trim();
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        sanitized[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = sanitizeObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
    return sanitized;
  };

  req.body = sanitizeObject(req.body);
  next();
};

// Rate limiting for sensitive operations
exports.rateLimitSensitive = (req, res, next) => {
  // This is a simple in-memory rate limiter
  // In production, use Redis or a proper rate limiting solution
  const rateLimitStore = global.rateLimitStore || (global.rateLimitStore = new Map());
  const key = `${req.ip}-${req.user?.id}-${req.route.path}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const userAttempts = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > userAttempts.resetTime) {
    userAttempts.count = 1;
    userAttempts.resetTime = now + windowMs;
  } else {
    userAttempts.count++;
  }

  rateLimitStore.set(key, userAttempts);

  if (userAttempts.count > maxAttempts) {
    return next(new ErrorResponse('Too many attempts. Please try again later.', 429));
  }

  next();
};