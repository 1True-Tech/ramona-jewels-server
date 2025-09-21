const User = require('../models/User');
const Cart = require('../models/Cart');
const asyncHandler = require('../utils/async');
const ErrorResponse = require('../utils/errorResponse');
const Order = require('../models/Order');

// @desc    Get all users with pagination and filtering
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  
  // Build query
  let query = {};
  
  // Search functionality
  if (req.query.search) {
    query.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } }
    ];
  }
  
  // Filter by role
  if (req.query.role && req.query.role !== 'all') {
    query.role = req.query.role === 'customer' ? 'user' : req.query.role;
  }
  
  // Filter by status
  if (req.query.status && req.query.status !== 'all') {
    query.isActive = req.query.status === 'active';
  }
  
  // Get total count for pagination
  const total = await User.countDocuments(query);
  
  // Execute query with pagination
  const users = await User.find(query)
    .select('-password -refreshTokens')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex);
  
  // Get order counts and total spent for each user
  const usersWithStats = await Promise.all(
    users.map(async (user) => {
      // Get cart data to calculate orders and total spent
      const carts = await Cart.find({ user: user._id });
      const orders = carts.length;
      const totalSpent = carts.reduce((total, cart) => {
        return total + (cart.totalPrice || 0);
      }, 0);
      
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '+1 (555) 000-0000', // Default phone if not available
        role: user.role === 'user' ? 'customer' : user.role,
        status: user.isActive ? 'active' : 'inactive',
        joinDate: user.createdAt.toISOString().split('T')[0],
        orders,
        totalSpent,
        avatar: '/placeholder.svg', // Default avatar
        lastActivity: user.lastLogin || user.updatedAt
      };
    })
  );
  
  res.status(200).json({
    success: true,
    data: usersWithStats,
    total,
    page,
    pages: Math.ceil(total / limit)
  });
});

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Private/Admin
exports.getUserStats = asyncHandler(async (req, res, next) => {
  const total = await User.countDocuments();
  const active = await User.countDocuments({ isActive: true });
  const inactive = await User.countDocuments({ isActive: false });
  const customers = await User.countDocuments({ role: 'user' });
  const admins = await User.countDocuments({ role: 'admin' });
  
  res.status(200).json({
    success: true,
    data: {
      total,
      active,
      inactive,
      customers,
      admins
    }
  });
});

// @desc    Get top users by total paid spend
// @route   GET /api/admin/users/top
// @access  Private/Admin
exports.getTopUsers = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit, 10) || 5;

  const topUsers = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    {
      $group: {
        _id: '$userId',
        orders: { $sum: 1 },
        totalSpent: { $sum: '$total' },
        lastActivity: { $max: '$createdAt' },
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: { 'user.isActive': true } },
    {
      $project: {
        _id: 0,
        id: '$_id',
        name: '$user.name',
        email: '$user.email',
        phone: { $ifNull: ['$user.phone', '+1 (555) 000-0000'] },
        role: { $cond: [{ $eq: ['$user.role', 'user'] }, 'customer', '$user.role'] },
        status: { $cond: ['$user.isActive', 'active', 'inactive'] },
        joinDate: { $dateToString: { format: '%Y-%m-%d', date: '$user.createdAt' } },
        orders: 1,
        totalSpent: 1,
        avatar: { $literal: '/placeholder.svg' },
        lastActivity: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: topUsers,
  });
});

// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-password -refreshTokens');
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  // Get user statistics
  const carts = await Cart.find({ user: user._id });
  const orders = carts.length;
  const totalSpent = carts.reduce((total, cart) => {
    return total + (cart.totalPrice || 0);
  }, 0);
  
  const userWithStats = {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '+1 (555) 000-0000',
    role: user.role === 'user' ? 'customer' : user.role,
    status: user.isActive ? 'active' : 'inactive',
    joinDate: user.createdAt.toISOString().split('T')[0],
    orders,
    totalSpent,
    avatar: '/placeholder.svg',
    lastActivity: user.lastLogin || user.updatedAt
  };
  
  res.status(200).json({
    success: true,
    data: userWithStats
  });
});

// @desc    Update user status
// @route   PATCH /api/admin/users/:id/status
// @access  Private/Admin
exports.updateUserStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  
  if (!status || !['active', 'inactive'].includes(status)) {
    return next(new ErrorResponse('Please provide a valid status (active or inactive)', 400));
  }
  
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: status === 'active' },
    { new: true, runValidators: true }
  ).select('-password -refreshTokens');
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  // Get user statistics
  const carts = await Cart.find({ user: user._id });
  const orders = carts.length;
  const totalSpent = carts.reduce((total, cart) => {
    return total + (cart.totalPrice || 0);
  }, 0);
  
  const userWithStats = {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '+1 (555) 000-0000',
    role: user.role === 'user' ? 'customer' : user.role,
    status: user.isActive ? 'active' : 'inactive',
    joinDate: user.createdAt.toISOString().split('T')[0],
    orders,
    totalSpent,
    avatar: '/placeholder.svg',
    lastActivity: user.lastLogin || user.updatedAt
  };
  
  res.status(200).json({
    success: true,
    data: userWithStats
  });
});

// @desc    Update user role
// @route   PATCH /api/admin/users/:id/role
// @access  Private/Admin
exports.updateUserRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;
  
  if (!role || !['customer', 'admin'].includes(role)) {
    return next(new ErrorResponse('Please provide a valid role (customer or admin)', 400));
  }
  
  const userRole = role === 'customer' ? 'user' : role;
  
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: userRole },
    { new: true, runValidators: true }
  ).select('-password -refreshTokens');
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  // Get user statistics
  const carts = await Cart.find({ user: user._id });
  const orders = carts.length;
  const totalSpent = carts.reduce((total, cart) => {
    return total + (cart.totalPrice || 0);
  }, 0);
  
  const userWithStats = {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '+1 (555) 000-0000',
    role: user.role === 'user' ? 'customer' : user.role,
    status: user.isActive ? 'active' : 'inactive',
    joinDate: user.createdAt.toISOString().split('T')[0],
    orders,
    totalSpent,
    avatar: '/placeholder.svg',
    lastActivity: user.lastLogin || user.updatedAt
  };
  
  res.status(200).json({
    success: true,
    data: userWithStats
  });
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  // Don't allow deleting the last admin
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      return next(new ErrorResponse('Cannot delete the last admin user', 400));
    }
  }
  
  // Delete user's carts as well
  await Cart.deleteMany({ user: req.params.id });
  
  await User.findByIdAndDelete(req.params.id);
  
  res.status(200).json({
    success: true,
    data: {}
  });
});