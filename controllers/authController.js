const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const sendTokenResponse = require('../utils/tokenResponse');
const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

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

  // Fire-and-forget welcome email (do not block registration flow)
  deliverWelcomeEmail(user.email, user.name).catch(() => {});

  sendTokenResponse(user, 200, res);
});

// @desc    Social Login with Google
// @route   POST /api/v1/auth/google
// @access  Public
exports.googleLogin = asyncHandler(async (req, res, next) => {
  const { idToken, clientId: clientIdFromBody, mode } = req.body;
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

  // If this request is explicitly a signup and the email already exists, block and inform user
  const existingByEmail = await User.findOne({ email });
  if (mode === 'signup' && existingByEmail) {
    return next(new ErrorResponse('Email already exists', 409));
  }

  // Proceed with normal google auth flow (sign in or create/link)
  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  let createdNew = false;
  if (!user) {
    // Create OAuth user without password
    user = await User.create({ name, email, provider: 'google', googleId });
    createdNew = true;
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

  // Block deactivated accounts from logging in via Google
  if (user && user.isActive === false) {
    return next(new ErrorResponse('Account has been suspended', 401));
  }

  // Send welcome email on first-time Google signup
  if (createdNew) {
    deliverWelcomeEmail(user.email, user.name).catch(() => {});
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
    return next(new ErrorResponse('Email or password is incorrect', 401));
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
    return next(new ErrorResponse('Email or password is incorrect', 401));
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
    let createdNew = false;
    if (!user) {
      user = await User.create({ name, email, provider: 'facebook', facebookId });
      createdNew = true;
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

    // Block deactivated accounts from logging in via Facebook
    if (user && user.isActive === false) {
      return next(new ErrorResponse('Account has been deactivated', 401));
    }

    // Send welcome email on first-time Facebook signup
    if (createdNew) {
      deliverWelcomeEmail(user.email, user.name).catch(() => {});
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

// Lightweight email delivery for password reset codes using Nodemailer only (never logs codes)
async function deliverResetCode(email, code) {
  try {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465; // true for 465, false for other ports
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.EMAIL_FROM;

    if (!host || !user || !pass || !from) {
      console.warn('Email transport not configured: set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM');
      return true; // Do not fail the flow; just avoid leaking the code
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const html = `
      <div style="font-family:Arial,sans-serif; color:#111;">
        <h2 style="margin:0 0 8px 0;">Password reset code</h2>
        <p style="margin:0 0 12px 0;">Use the 6-digit code below to reset your Ramona Jewels account password. This code expires in 10 minutes.</p>
        <div style="font-size:28px; font-weight:700; letter-spacing:6px; padding:12px 16px; background:#f4f4f5; display:inline-block; border-radius:8px;">${code}</div>
        <p style="margin:16px 0 0 0; color:#555;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Your Ramona Jewels password reset code',
      html,
    });

    return true;
  } catch (e) {
    console.warn('deliverResetCode error', e);
    return false;
  }
}

// @desc    Forgot password (request reset code)
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) return next(new ErrorResponse('Please provide an email', 400));

  const user = await User.findOne({ email }).select('+resetPasswordAttempts +resetPasswordExpires');
  if (!user) return next(new ErrorResponse('Email not found', 404));

  // Rate-limit attempts: max 3 within 30 minutes
  const now = Date.now();
  if (user.resetPasswordAttempts && user.resetPasswordExpires && user.resetPasswordExpires > now) {
    return next(new ErrorResponse('Too many requests, please try again later', 429));
  }

  // Generate a 6-digit code and expiry
  const code = String(Math.floor(100000 + Math.random() * 900000));
  user.resetPasswordCode = code;
  user.resetPasswordExpires = new Date(now + 10 * 60 * 1000); // 10 minutes
  user.resetPasswordAttempts = 1;
  await user.save({ validateModifiedOnly: true });

  // Attempt to email the code, but never log it
  await deliverResetCode(user.email, code);

  res.status(200).json({ success: true, message: 'If this email exists, a reset code has been sent' });
});

// @desc    Verify reset code
// @route   POST /api/v1/auth/verify-code
// @access  Public
exports.verifyResetCode = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;

  if (!email || !code) return next(new ErrorResponse('Please provide email and code', 400));

  const user = await User.findOne({ email }).select('+resetPasswordCode +resetPasswordExpires');
  if (!user || !user.resetPasswordCode || !user.resetPasswordExpires) {
    return next(new ErrorResponse('Invalid code', 400));
  }

  if (user.resetPasswordExpires < Date.now() || user.resetPasswordCode !== code) {
    return next(new ErrorResponse('Invalid or expired code', 400));
  }

  res.status(200).json({ success: true, message: 'Code verified' });
});

// @desc    Reset password
// @route   POST /api/v1/auth/resetpassword
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) return next(new ErrorResponse('Please provide email, code, and new password', 400));

  const user = await User.findOne({ email }).select('+resetPasswordCode +resetPasswordExpires');
  if (!user || !user.resetPasswordCode || !user.resetPasswordExpires) {
    return next(new ErrorResponse('Invalid code', 400));
  }

  if (user.resetPasswordExpires < Date.now() || user.resetPasswordCode !== code) {
    return next(new ErrorResponse('Invalid or expired code', 400));
  }

  user.password = newPassword;
  user.resetPasswordCode = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// Lightweight welcome email delivery (non-blocking, best-effort)
async function deliverWelcomeEmail(email, name) {
  try {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    const user = (process.env.SMTP_USER || '').trim();
    let pass = process.env.SMTP_PASS || '';
    // Normalize common Gmail app password format (remove spaces)
    pass = pass.replace(/\s+/g, '');
    let from = (process.env.EMAIL_FROM || '').trim();
    const displayName = (process.env.EMAIL_FROM_NAME || 'Ramona Jewels').trim();

    if (!host || !user || !pass) {
      console.warn('Email transport not configured: set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS');
      return true; // Do not fail signup if email is not configured
    }

    // Fallback to a valid from header if misconfigured
    if (!from) {
      from = `${displayName} <${user}>`;
    }

    let transporter;
    // Use Gmail service config automatically when SMTP host is Gmail
    if (/gmail\.com$/i.test(host)) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    }

    // Resolve public app url for links
    const appUrl = process.env.BASE_URL || process.env.CLIENT_URL || '';
    const safeName = (name && String(name).trim()) || (email?.split('@')[0]) || 'there';
    const html = `
      <div style="font-family:Arial,sans-serif; color:#111;">
        <h1 style="margin:0 0 12px 0; font-size: 22px;">Welcome to <span style="color:#ffbf00;">Monas Kreashon</span>, ${safeName}!</h1>
        <p style="margin:0 0 12px 0; font-size: 14px;">We're thrilled to have you here. Your account has been created successfully.</p>
        <p style="margin:0 0 12px">Here are some quick links to help you get started:</p>
        <ul style="margin:0 0 16px 20px;">
          <li><a href="${appUrl || ''}" style="color:#ffbf00; text-decoration:none;">Browse our latest collections</a></li>
          <li><a href="${(appUrl || '') + '/profile'}" style="color:#ffbf00; text-decoration:none;">Update your profile</a></li>
          <li><a href="${(appUrl || '') + '/wishlist'}" style="color:#ffbf00; text-decoration:none;">Start your wishlist</a></li>
        </ul>
        <p style="margin:0 0 12px 0; color:#555;">If you have any questions, just reply to this email — we're always happy to help.</p>
        <p style="margin:16px 0 0 0;">With warmth,<br/>The Monas Kreashon Team</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Welcome to Ramona Jewels ✨',
      html,
    });

    return true;
  } catch (e) {
    console.warn('deliverWelcomeEmail error', e);
    return false;
  }
}