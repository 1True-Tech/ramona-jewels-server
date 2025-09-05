const express = require('express');
const {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  getUserStats,
  deleteAvatar,
} = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const {
  validateProfileUpdate,
  validatePasswordChange,
  handleValidationErrors,
  sanitizeInput,
  rateLimitSensitive,
} = require('../middlewares/validation');

const router = express.Router();

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile', protect, getProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zipCode:
 *                     type: string
 *                   country:
 *                     type: string
 *               preferences:
 *                 type: object
 *                 properties:
 *                   notifications:
 *                     type: boolean
 *                   newsletter:
 *                     type: boolean
 *                   twoFactorAuth:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/profile', protect, sanitizeInput, validateProfileUpdate, handleValidationErrors, updateProfile);

/**
 * @swagger
 * /users/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized or incorrect current password
 *       404:
 *         description: User not found
 */
router.post('/change-password', protect, rateLimitSensitive, sanitizeInput, validatePasswordChange, handleValidationErrors, changePassword);

/**
 * @swagger
 * /users/upload-avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Image file (max 5MB)
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: string
 *                   description: Avatar URL
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid file or file too large
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: File upload error
 */
router.post('/upload-avatar', protect, rateLimitSensitive, uploadAvatar);

/**
 * @swagger
 * /users/avatar:
 *   delete:
 *     summary: Delete user avatar
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: No avatar to delete
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.delete('/avatar', protect, deleteAvatar);

/**
 * @swagger
 * /users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalOrders:
 *                       type: number
 *                     totalSpent:
 *                       type: number
 *                     wishlistItems:
 *                       type: number
 *                     reviewsCount:
 *                       type: number
 *                     memberSince:
 *                       type: string
 *                       format: date-time
 *                     daysSinceMember:
 *                       type: number
 *                     lastLogin:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/stats', protect, getUserStats);

module.exports = router;