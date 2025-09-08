const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const sendTokenResponse = require('../utils/tokenResponse');
const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role,
  });

  sendTokenResponse(user, 200, res);
});

// @desc    Social Login with Google
// @route   POST /api/v1/auth/google
// @access  Public
exports.googleLogin = asyncHandler(async (req, res, next) => {
  const { idToken, clientId: clientIdFromBody } = req.body;
  const clientId = process.env.GOOGLE_CLIENT_ID || clientIdFromBody;
  if (!idToken || !clientId) {
    return next(new ErrorResponse('Missing Google token or client ID', 400));
  }
  const client = new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch (e) {
    return next(new ErrorResponse('Invalid Google token', 401));
  }

  const email = payload?.email;
  const name = payload?.name || email?.split('@')[0] || 'Google User';
  const googleId = payload?.sub;
  if (!email) return next(new ErrorResponse('Google account has no email', 400));

  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  if (!user) {
    // Create OAuth user without password
    user = await User.create({ name, email, provider: 'google', googleId });
  } else {
    // Link Google account if not linked yet
    let shouldSave = false;
    if (!user.googleId && googleId) {
      user.googleId = googleId;
      shouldSave = true;
    }
    if (!user.provider) {
      user.provider = 'google';
      shouldSave = true;
    }
    if (shouldSave) await user.save({ validateModifiedOnly: true });
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if user account is locked
  if (user.isLocked) {
    return next(new ErrorResponse('Account temporarily locked due to too many failed login attempts', 423));
  }

  // Check if user is active
  if (!user.isActive) {
    return next(new ErrorResponse('Account has been deactivated', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    // Increment login attempts
    await user.incLoginAttempts();
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Social Login with Facebook
// @route   POST /api/v1/auth/facebook
// @access  Public
exports.facebookLogin = asyncHandler(async (req, res, next) => {
  const { accessToken } = req.body;
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  if (!accessToken || !appId || !appSecret) {
    return next(new ErrorResponse('Missing Facebook token or app credentials', 400));
  }

  try {
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`;
    const debugRes = await fetch(debugUrl);
    const debugData = await debugRes.json();
    if (!debugData?.data?.is_valid) {
      return next(new ErrorResponse('Invalid Facebook token', 401));
    }

    const meRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
    const me = await meRes.json();
    const email = me?.email;
    const name = me?.name || 'Facebook User';
    const facebookId = me?.id;
    if (!email) {
      return next(new ErrorResponse('Facebook account has no email', 400));
    }

    let user = await User.findOne({ $or: [{ facebookId }, { email }] });
    if (!user) {
      user = await User.create({ name, email, provider: 'facebook', facebookId });
    } else {
      let shouldSave = false;
      if (!user.facebookId && facebookId) {
        user.facebookId = facebookId;
        shouldSave = true;
      }
      if (!user.provider) {
        user.provider = 'facebook';
        shouldSave = true;
      }
      if (shouldSave) await user.save({ validateModifiedOnly: true });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    return next(new ErrorResponse('Facebook authentication failed', 500));
  }
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Log user out / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Refresh token
// @route   POST /api/v1/auth/refresh
// @access  Private
exports.refreshToken = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Update user profile
// @route   PUT /api/v1/auth/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    email: req.body.email,
  };

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Change password
// @route   PUT /api/v1/auth/password
// @access  Private
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ErrorResponse('Please provide current and new password', 400));
  }

  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }

  user.password = newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});