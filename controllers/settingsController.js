const asyncHandler = require('../utils/async');
const Settings = require('../models/Settings');

// @desc    Get admin settings
// @route   GET /api/v1/admin/settings
// @access  Private/Admin
exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  res.status(200).json({ success: true, data: settings });
});

// @desc    Update admin settings (real-time)
// @route   PATCH /api/v1/admin/settings
// @access  Private/Admin
exports.updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const settings = await Settings.getSingleton();

  if (typeof updates?.payments?.stripe?.enabled === 'boolean') {
    settings.payments = settings.payments || {};
    settings.payments.stripe = settings.payments.stripe || {};
    settings.payments.stripe.enabled = updates.payments.stripe.enabled;
  }

  settings.updatedBy = req.user.id;
  await settings.save();

  res.status(200).json({ success: true, data: settings, message: 'Settings updated' });
});