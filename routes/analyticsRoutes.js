const express = require('express');
const {
  getAnalyticsDashboard,
  getSalesData,
  getRevenueMetrics,
  getProductPerformance,
  getCategoryPerformance,
  getCustomerInsights,
  getInventoryInsights,
  getTrafficData
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// All analytics routes require admin access
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/analytics/dashboard
// @desc    Get analytics dashboard data
// @access  Private/Admin
router.get('/dashboard', getAnalyticsDashboard);

// @route   GET /api/admin/analytics/sales
// @desc    Get sales data
// @access  Private/Admin
router.get('/sales', getSalesData);

// @route   GET /api/admin/analytics/revenue
// @desc    Get revenue metrics
// @access  Private/Admin
router.get('/revenue', getRevenueMetrics);

// @route   GET /api/admin/analytics/products
// @desc    Get product performance
// @access  Private/Admin
router.get('/products', getProductPerformance);

// @route   GET /api/admin/analytics/categories
// @desc    Get category performance
// @access  Private/Admin
router.get('/categories', getCategoryPerformance);

// @route   GET /api/admin/analytics/customers
// @desc    Get customer insights
// @access  Private/Admin
router.get('/customers', getCustomerInsights);

// @route   GET /api/admin/analytics/inventory
// @desc    Get inventory insights
// @access  Private/Admin
router.get('/inventory', getInventoryInsights);

// @route   GET /api/admin/analytics/traffic
// @desc    Get traffic data
// @access  Private/Admin
router.get('/traffic', getTrafficData);

module.exports = router;