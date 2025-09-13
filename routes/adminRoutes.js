const express = require('express');
const {
  getUsers,
  getUserStats,
  getTopUsers,
  getUser,
  updateUserStatus,
  updateUserRole,
  deleteUser
} = require('../controllers/adminController');

const { protect, authorize } = require('../middlewares/auth');
// Add settings controller handlers
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = express.Router();

// Protect all routes and require admin role
router.use(protect);
router.use(authorize('admin'));

// User management routes
router.route('/users')
  .get(getUsers);

router.route('/users/stats')
  .get(getUserStats);

router.route('/users/top')
  .get(getTopUsers);

router.route('/users/:id')
  .get(getUser)
  .delete(deleteUser);

router.route('/users/:id/status')
  .patch(updateUserStatus);

router.route('/users/:id/role')
  .patch(updateUserRole);

// Settings routes
router.route('/settings')
  .get(getSettings)
  .patch(updateSettings);

module.exports = router;