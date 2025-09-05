const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const path = require('path');
const fs = require('fs');

// @desc    Get current user profile
// @route   GET /api/v1/users/profile
// @access  Private
exports.getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password -refreshTokens');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Update user profile
// @route   PUT /api/v1/users/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const {
    name,
    email,
    phone,
    bio,
    address,
    preferences,
  } = req.body;

  // Build update object with only provided fields
  const fieldsToUpdate = {};
  
  if (name !== undefined) fieldsToUpdate.name = name;
  if (email !== undefined) fieldsToUpdate.email = email;
  if (phone !== undefined) fieldsToUpdate.phone = phone;
  if (bio !== undefined) fieldsToUpdate.bio = bio;
  
  // Handle address updates properly
  if (address) {
    if (address.street !== undefined) fieldsToUpdate['address.street'] = address.street;
    if (address.city !== undefined) fieldsToUpdate['address.city'] = address.city;
    if (address.state !== undefined) fieldsToUpdate['address.state'] = address.state;
    if (address.zipCode !== undefined) fieldsToUpdate['address.zipCode'] = address.zipCode;
    if (address.country !== undefined) fieldsToUpdate['address.country'] = address.country;
  }
  
  // Handle preferences updates properly
  if (preferences) {
    if (preferences.notifications !== undefined) fieldsToUpdate['preferences.notifications'] = preferences.notifications;
    if (preferences.newsletter !== undefined) fieldsToUpdate['preferences.newsletter'] = preferences.newsletter;
    if (preferences.twoFactorAuth !== undefined) fieldsToUpdate['preferences.twoFactorAuth'] = preferences.twoFactorAuth;
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true,
      }
    ).select('-password -refreshTokens');

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new ErrorResponse('Email already exists', 400));
    }
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map(val => val.message).join(', ');
      return next(new ErrorResponse(message, 400));
    }
    return next(new ErrorResponse('Server error', 500));
  }
});

// @desc    Change user password
// @route   POST /api/v1/users/change-password
// @access  Private
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return next(new ErrorResponse('Please provide current password, new password, and confirm password', 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new ErrorResponse('New password and confirm password do not match', 400));
  }

  if (newPassword.length < 6) {
    return next(new ErrorResponse('New password must be at least 6 characters', 400));
  }

  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check current password
  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

// @desc    Upload user avatar
// @route   POST /api/v1/users/upload-avatar
// @access  Private
exports.uploadAvatar = asyncHandler(async (req, res, next) => {
  if (!req.files || !req.files.avatar) {
    return next(new ErrorResponse('Please upload an image file', 400));
  }

  const file = req.files.avatar;

  // Make sure the image is a photo
  if (!file.mimetype.startsWith('image')) {
    return next(new ErrorResponse('Please upload an image file', 400));
  }

  // Check filesize
  if (file.size > process.env.MAX_FILE_UPLOAD || file.size > 5000000) { // 5MB default
    return next(new ErrorResponse('Please upload an image less than 5MB', 400));
  }

  // Create custom filename
  file.name = `avatar_${req.user.id}${path.parse(file.name).ext}`;

  // Create upload directory if it doesn't exist
  const uploadPath = path.join(__dirname, '../public/uploads/avatars');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const filePath = path.join(uploadPath, file.name);

  // Remove old avatar if exists
  const user = await User.findById(req.user.id);
  if (user.avatar) {
    const oldAvatarPath = path.join(uploadPath, path.basename(user.avatar));
    if (fs.existsSync(oldAvatarPath)) {
      fs.unlinkSync(oldAvatarPath);
    }
  }

  file.mv(filePath, async (err) => {
    if (err) {
      console.error(err);
      return next(new ErrorResponse('Problem with file upload', 500));
    }

    // Update user avatar field
    const avatarUrl = `/uploads/avatars/${file.name}`;
    await User.findByIdAndUpdate(req.user.id, { avatar: avatarUrl });

    res.status(200).json({
      success: true,
      data: avatarUrl,
      message: 'Avatar uploaded successfully',
    });
  });
});

// @desc    Get user statistics
// @route   GET /api/v1/users/stats
// @access  Private
exports.getUserStats = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('stats createdAt lastLogin');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Calculate additional stats
  const memberSince = user.createdAt;
  const daysSinceMember = Math.floor((Date.now() - memberSince) / (1000 * 60 * 60 * 24));
  
  const stats = {
    ...user.stats.toObject(),
    memberSince,
    daysSinceMember,
    lastLogin: user.lastLogin,
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
});

// @desc    Delete user avatar
// @route   DELETE /api/v1/users/avatar
// @access  Private
exports.deleteAvatar = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.avatar) {
    return next(new ErrorResponse('No avatar to delete', 400));
  }

  // Remove avatar file
  const avatarPath = path.join(__dirname, '../public', user.avatar);
  if (fs.existsSync(avatarPath)) {
    fs.unlinkSync(avatarPath);
  }

  // Update user avatar field
  await User.findByIdAndUpdate(req.user.id, { avatar: '' });

  res.status(200).json({
    success: true,
    message: 'Avatar deleted successfully',
  });
});