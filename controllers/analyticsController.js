const Order = require('../models/Order');
const Perfume = require('../models/Products');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

// @desc    Get analytics dashboard data
// @route   GET /api/admin/analytics/dashboard
// @access  Private/Admin
const getAnalyticsDashboard = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    // Date range filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total revenue
    const revenueResult = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // Total orders
    const totalOrders = await Order.countDocuments({
      ...dateFilter,
      status: { $ne: 'cancelled' }
    });

    // Total customers
    const totalCustomers = await User.countDocuments({
      ...dateFilter,
      role: 'user'
    });

    // Average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Conversion rate (mock calculation - would need actual traffic data)
    const conversionRate = 2.5; // Mock value

    // Growth metrics (comparing to previous period)
    const previousPeriodStart = startDate ? 
      new Date(new Date(startDate).getTime() - (new Date(endDate || new Date()) - new Date(startDate))) : 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const previousPeriodEnd = startDate ? new Date(startDate) : new Date();

    const previousRevenueResult = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
          status: { $ne: 'cancelled' }
        }
      },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    const previousRevenue = previousRevenueResult[0]?.totalRevenue || 0;

    const previousOrders = await Order.countDocuments({
      createdAt: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
      status: { $ne: 'cancelled' }
    });

    const revenueGrowth = previousRevenue > 0 ? 
      ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersGrowth = previousOrders > 0 ? 
      ((totalOrders - previousOrders) / previousOrders) * 100 : 0;

    // Get top products for dashboard
    const topProducts = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          sales: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'perfumes',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $project: {
          id: '$_id',
          name: { $arrayElemAt: ['$productInfo.name', 0] },
          category: { $arrayElemAt: ['$productInfo.category', 0] },
          sales: 1,
          revenue: 1,
          views: 0,
          conversionRate: 0,
          image: { $arrayElemAt: ['$productInfo.images', 0] }
        }
      }
    ]);

    // Payment status breakdown and trends
    const __now = new Date();
    const __currStart = startDate ? new Date(startDate) : new Date(__now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const __currEnd = endDate ? new Date(endDate) : __now;
    const __period = Math.max(1, __currEnd.getTime() - __currStart.getTime());
    const __prevStart = new Date(__currStart.getTime() - __period);
    const __prevEnd = __currStart;

    const __statusAggCurrent = await Order.aggregate([
      { $match: { createdAt: { $gte: __currStart, $lte: __currEnd }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$paymentStatus', amount: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);

    const __statusAggPrev = await Order.aggregate([
      { $match: { createdAt: { $gte: __prevStart, $lte: __prevEnd }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$paymentStatus', amount: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);

    const __init = { paid: { amount: 0, count: 0 }, pending: { amount: 0, count: 0 }, failed: { amount: 0, count: 0 }, refunded: { amount: 0, count: 0 } };
    const __toMap = (agg) => agg.reduce((a, i) => { a[i._id] = { amount: i.amount, count: i.count }; return a; }, { ...__init });

    const __curr = __toMap(__statusAggCurrent);
    const __prev = __toMap(__statusAggPrev);

    var __totalPaidRevenue = __curr.paid.amount || 0;
    var __totalPaidCount = __curr.paid.count || 0;
    var __pendingCount = __curr.pending.count || 0;
    var __failedCount = __curr.failed.count || 0;
    var __refundedCount = __curr.refunded.count || 0;

    const __prevPaidRevenue = __prev.paid.amount || 0;
    var __paidRevenueGrowth = __prevPaidRevenue > 0 ? ((__totalPaidRevenue - __prevPaidRevenue) / __prevPaidRevenue) * 100 : 0;

    const __pct = (c, p) => (p > 0 ? ((c - p) / p) * 100 : 0);
    var __statusTrends = {
      paid: __pct(__totalPaidCount, __prev.paid.count || 0),
      pending: __pct(__pendingCount, __prev.pending.count || 0),
      failed: __pct(__failedCount, __prev.failed.count || 0),
      refunded: __pct(__refundedCount, __prev.refunded.count || 0),
    };

    var __paymentStatusBreakdown = [
      { status: 'paid', amount: __totalPaidRevenue, count: __totalPaidCount },
      { status: 'pending', amount: __curr.pending.amount || 0, count: __pendingCount },
      { status: 'failed', amount: __curr.failed.amount || 0, count: __failedCount },
      { status: 'refunded', amount: __curr.refunded.amount || 0, count: __refundedCount },
    ];

    res.json({
      success: true,
      data: {
        revenue: {
          totalRevenue,
          monthlyRevenue: totalRevenue,
          yearlyRevenue: totalRevenue,
          revenueGrowth,
          averageOrderValue,
          totalOrders,
          conversionRate
        },
        sales: [],
        customers: {
          totalCustomers,
          newCustomers: Math.floor(totalCustomers * 0.3),
          returningCustomers: Math.floor(totalCustomers * 0.7),
          averageOrderValue,
          customerLifetimeValue: averageOrderValue * 3,
          topCustomers: []
        },
        products: topProducts,
        categories: [],
        inventory: {
          totalProducts: await Perfume.countDocuments(),
          lowStockProducts: 0,
          outOfStockProducts: 0,
          topSellingProducts: topProducts,
          slowMovingProducts: []
        },
        traffic: []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics dashboard',
      error: error.message
    });
  }
});

// @desc    Get sales data
// @route   GET /api/admin/analytics/sales
// @access  Private/Admin
const getSalesData = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'daily' } = req.query;
  
  try {
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    let groupBy;
    switch (period) {
      case 'hourly':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'weekly':
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'monthly':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default: // daily
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const salesData = await Order.aggregate([
      { $match: { ...dateFilter } },
      {
        $group: {
          _id: groupBy,
          // Exclude cancelled orders from core revenue/orders metrics
          revenue: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0] } },
          orders: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } },
          // Status-based sums for chart series
          paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$total', 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, '$total', 0] } },
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);

    // Transform data for frontend
    const transformedData = salesData.map(item => {
      let date;
      if (period === 'hourly') {
        date = new Date(item._id.year, item._id.month - 1, item._id.day, item._id.hour);
      } else if (period === 'weekly') {
        date = new Date(item._id.year, 0, (item._id.week - 1) * 7);
      } else if (period === 'monthly') {
        date = new Date(item._id.year, item._id.month - 1, 1);
      } else {
        date = new Date(item._id.year, item._id.month - 1, item._id.day);
      }

      return {
        date: date.toISOString(),
        revenue: item.revenue,
        orders: item.orders,
        averageOrderValue: item.orders > 0 ? item.revenue / item.orders : 0,
        paid: item.paid || 0,
        pending: item.pending || 0,
        cancelled: item.cancelled || 0,
      };
    });

    res.json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sales data',
      error: error.message
    });
  }
});

// Reusable helpers for realtime analytics
async function computePaymentStatusMetrics({ startDate, endDate } = {}) {
  const now = new Date();
  const currStart = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const currEnd = endDate ? new Date(endDate) : now;
  const periodMs = Math.max(1, currEnd.getTime() - currStart.getTime());
  const prevStart = new Date(currStart.getTime() - periodMs);
  const prevEnd = currStart;

  const statusAggCurrent = await Order.aggregate([
    { $match: { createdAt: { $gte: currStart, $lte: currEnd }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$paymentStatus', amount: { $sum: '$total' }, count: { $sum: 1 } } }
  ]);
  const statusAggPrev = await Order.aggregate([
    { $match: { createdAt: { $gte: prevStart, $lte: prevEnd }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$paymentStatus', amount: { $sum: '$total' }, count: { $sum: 1 } } }
  ]);

  const init = { paid: { amount: 0, count: 0 }, pending: { amount: 0, count: 0 }, failed: { amount: 0, count: 0 }, refunded: { amount: 0, count: 0 } };
  const toMap = (agg) => agg.reduce((a, i) => { a[i._id] = { amount: i.amount, count: i.count }; return a; }, { ...init });
  const curr = toMap(statusAggCurrent);
  const prev = toMap(statusAggPrev);

  const totalPaidRevenue = curr.paid.amount || 0;
  const totalPaidCount = curr.paid.count || 0;
  const pendingCount = curr.pending.count || 0;
  const failedCount = curr.failed.count || 0;
  const refundedCount = curr.refunded.count || 0;
  const prevPaidRevenue = prev.paid.amount || 0;
  const paidRevenueGrowth = prevPaidRevenue > 0 ? ((totalPaidRevenue - prevPaidRevenue) / prevPaidRevenue) * 100 : 0;
  const pct = (c, p) => (p > 0 ? ((c - p) / p) * 100 : 0);
  const statusTrends = {
    paid: pct(totalPaidCount, prev.paid.count || 0),
    pending: pct(pendingCount, prev.pending.count || 0),
    failed: pct(failedCount, prev.failed.count || 0),
    refunded: pct(refundedCount, prev.refunded.count || 0),
  };
  const paymentStatusBreakdown = [
    { status: 'paid', amount: totalPaidRevenue, count: totalPaidCount },
    { status: 'pending', amount: curr.pending.amount || 0, count: pendingCount },
    { status: 'failed', amount: curr.failed.amount || 0, count: failedCount },
    { status: 'refunded', amount: curr.refunded.amount || 0, count: refundedCount },
  ];

  return { totalPaidRevenue, totalPaidCount, pendingCount, failedCount, refundedCount, paidRevenueGrowth, paymentStatusBreakdown, statusTrends };
}

async function computeAnalyticsSnapshot({ startDate, endDate } = {}) {
  let dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const revenueResult = await Order.aggregate([
    { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
  ]);
  const totalRevenue = revenueResult[0]?.totalRevenue || 0;
  const totalOrders = await Order.countDocuments({ ...dateFilter, status: { $ne: 'cancelled' } });
  const totalCustomers = await User.countDocuments({ ...dateFilter, role: 'user' });
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const conversionRate = 2.5;

  const now = new Date();
  const currStart = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const currEnd = endDate ? new Date(endDate) : now;
  const periodMs = Math.max(1, currEnd.getTime() - currStart.getTime());
  const prevStart = new Date(currStart.getTime() - periodMs);
  const prevEnd = currStart;
  const prevRevenueResult = await Order.aggregate([
    { $match: { createdAt: { $gte: prevStart, $lte: prevEnd }, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
  ]);
  const previousRevenue = prevRevenueResult[0]?.totalRevenue || 0;
  const previousOrders = await Order.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd }, status: { $ne: 'cancelled' } });
  const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  const ordersGrowth = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0;

  const topProducts = await Order.aggregate([
    { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', name: { $first: '$items.name' }, sales: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
    { $sort: { revenue: -1 } },
    { $limit: 5 }
  ]);

  const payment = await computePaymentStatusMetrics({ startDate, endDate });

  return {
    revenue: {
      totalRevenue,
      monthlyRevenue: totalRevenue,
      yearlyRevenue: totalRevenue,
      revenueGrowth,
      ordersGrowth,
      averageOrderValue,
      totalOrders,
      conversionRate,
      ...payment,
    },
    customers: {
      totalCustomers,
      newCustomers: Math.floor(totalCustomers * 0.3),
      returningCustomers: Math.floor(totalCustomers * 0.7),
      averageOrderValue,
      customerLifetimeValue: averageOrderValue * 3,
      topCustomers: []
    },
    products: topProducts,
  };
}

// @desc    Get revenue metrics
// @route   GET /api/admin/analytics/revenue
// @access  Private/Admin
const getRevenueMetrics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const revenueResult = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' }, totalOrders: { $sum: 1 }, averageOrderValue: { $avg: '$total' }, totalShipping: { $sum: '$shipping' }, totalTax: { $sum: '$tax' }, totalDiscount: { $sum: '$discount' } } }
    ]);

    const metrics = revenueResult[0] || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0, totalShipping: 0, totalTax: 0, totalDiscount: 0 };

    const revenueByPayment = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$paymentMethod', revenue: { $sum: '$total' }, orders: { $sum: 1 } } }
    ]);

    const monthlyRevenue = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$total' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const now = new Date();
    const currStart = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const currEnd = endDate ? new Date(endDate) : now;
    const periodMs = Math.max(1, currEnd.getTime() - currStart.getTime());
    const prevStart = new Date(currStart.getTime() - periodMs);
    const prevEnd = currStart;
    const prevRevenueAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: prevStart, $lte: prevEnd }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    const previousRevenue = prevRevenueAgg[0]?.totalRevenue || 0;
    const revenueGrowth = previousRevenue > 0 ? ((metrics.totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const payment = await computePaymentStatusMetrics({ startDate, endDate });

    res.json({
      success: true,
      data: {
        ...metrics,
        revenueGrowth,
        revenueByPaymentMethod: revenueByPayment,
        monthlyRevenue: monthlyRevenue.map(item => ({ month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`, revenue: item.revenue })),
        ...payment,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching revenue metrics', error: error.message });
  }
});

// @desc    Get product performance
// @route   GET /api/admin/analytics/products
// @access  Private/Admin
const getProductPerformance = asyncHandler(async (req, res) => {
  const { startDate, endDate, limit = 10 } = req.query;
  
  try {
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Top selling products
    const topProducts = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          averagePrice: { $avg: '$items.price' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Product performance with additional metrics
    const productIds = topProducts.map(p => p._id);
    const perfumes = await Perfume.find({ _id: { $in: productIds } });
    
    const enhancedProducts = topProducts.map(product => {
      const perfumeInfo = perfumes.find(p => p._id.toString() === product._id.toString());
      return {
        id: product._id,
        name: product.name,
        totalSold: product.totalSold,
        totalRevenue: product.totalRevenue,
        averagePrice: product.averagePrice,
        currentStock: perfumeInfo?.stockCount || 0,
        category: perfumeInfo?.category || 'Unknown',
        image: perfumeInfo?.image || null
      };
    });

    res.json({
      success: true,
      data: enhancedProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching product performance',
      error: error.message
    });
  }
});

// @desc    Get category performance
// @route   GET /api/admin/analytics/categories
// @access  Private/Admin
const getCategoryPerformance = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all perfumes to map categories
    const perfumes = await Perfume.find({}, 'category');
    const productCategoryMap = {};
    perfumes.forEach(perfume => {
      productCategoryMap[perfume._id.toString()] = perfume.category;
    });

    // Category performance
    const categoryStats = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      }
    ]);

    // Group by category
    const categoryPerformance = {};
    categoryStats.forEach(stat => {
      const category = productCategoryMap[stat._id.toString()] || 'Unknown';
      if (!categoryPerformance[category]) {
        categoryPerformance[category] = {
          category,
          totalSold: 0,
          totalRevenue: 0,
          productCount: 0
        };
      }
      categoryPerformance[category].totalSold += stat.totalSold;
      categoryPerformance[category].totalRevenue += stat.totalRevenue;
      categoryPerformance[category].productCount += 1;
    });

    const result = Object.values(categoryPerformance).sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category performance',
      error: error.message
    });
  }
});

// @desc    Get customer insights
// @route   GET /api/admin/analytics/customers
// @access  Private/Admin
const getCustomerInsights = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Customer lifetime value
    const customerStats = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$userId',
          totalSpent: { $sum: '$total' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$total' },
          firstOrder: { $min: '$createdAt' },
          lastOrder: { $max: '$createdAt' }
        }
      }
    ]);

    // Calculate metrics
    const totalCustomers = customerStats.length;
    const totalLifetimeValue = customerStats.reduce((sum, customer) => sum + customer.totalSpent, 0);
    const averageLifetimeValue = totalCustomers > 0 ? totalLifetimeValue / totalCustomers : 0;
    const averageOrdersPerCustomer = totalCustomers > 0 ? 
      customerStats.reduce((sum, customer) => sum + customer.orderCount, 0) / totalCustomers : 0;

    // Customer segments
    const highValueCustomers = customerStats.filter(c => c.totalSpent > 500).length;
    const mediumValueCustomers = customerStats.filter(c => c.totalSpent >= 100 && c.totalSpent <= 500).length;
    const lowValueCustomers = customerStats.filter(c => c.totalSpent < 100).length;

    // Repeat customers
    const repeatCustomers = customerStats.filter(c => c.orderCount > 1).length;
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    // New vs returning customers (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newCustomers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      role: 'user'
    });

    res.json({
      success: true,
      data: {
        totalCustomers,
        averageLifetimeValue,
        averageOrdersPerCustomer,
        repeatCustomerRate,
        newCustomers,
        customerSegments: {
          high: highValueCustomers,
          medium: mediumValueCustomers,
          low: lowValueCustomers
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching customer insights',
      error: error.message
    });
  }
});

// @desc    Get inventory insights
// @route   GET /api/admin/analytics/inventory
// @access  Private/Admin
const getInventoryInsights = asyncHandler(async (req, res) => {
  try {
    // Low stock products
    const lowStockProducts = await Perfume.find({ stockCount: { $lt: 10 } })
      .select('name stockCount category price')
      .sort({ stockCount: 1 });

    // Out of stock products
    const outOfStockProducts = await Perfume.find({ stockCount: 0 })
      .select('name category price')
      .sort({ name: 1 });

    // Total inventory value
    const inventoryValue = await Perfume.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$price', '$stockCount'] } },
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stockCount' }
        }
      }
    ]);

    const metrics = inventoryValue[0] || {
      totalValue: 0,
      totalProducts: 0,
      totalStock: 0
    };

    // Category distribution
    const categoryDistribution = await Perfume.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalStock: { $sum: '$stockCount' },
          averagePrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        ...metrics,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        lowStockProducts: lowStockProducts.slice(0, 10), // Top 10
        outOfStockProducts: outOfStockProducts.slice(0, 10), // Top 10
        categoryDistribution
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory insights',
      error: error.message
    });
  }
});

// @desc    Get traffic data (mock implementation)
// @route   GET /api/admin/analytics/traffic
// @access  Private/Admin
const getTrafficData = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    // This would typically come from analytics services like Google Analytics
    // For now, we'll provide mock data based on order patterns
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Use order data as a proxy for traffic patterns
    const dailyOrders = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Mock traffic data based on order patterns
    const trafficData = dailyOrders.map(day => {
      const date = new Date(day._id.year, day._id.month - 1, day._id.day);
      // Assume 50-100 visitors per order
      const visitors = day.orders * (50 + Math.random() * 50);
      const pageViews = visitors * (2 + Math.random() * 3);
      const bounceRate = 30 + Math.random() * 40; // 30-70%
      
      return {
        date: date.toISOString().split('T')[0],
        visitors: Math.round(visitors),
        pageViews: Math.round(pageViews),
        bounceRate: Math.round(bounceRate * 100) / 100,
        conversions: day.orders
      };
    });

    // Calculate totals
    const totalVisitors = trafficData.reduce((sum, day) => sum + day.visitors, 0);
    const totalPageViews = trafficData.reduce((sum, day) => sum + day.pageViews, 0);
    const totalConversions = trafficData.reduce((sum, day) => sum + day.conversions, 0);
    const averageBounceRate = trafficData.length > 0 ? 
      trafficData.reduce((sum, day) => sum + day.bounceRate, 0) / trafficData.length : 0;
    const conversionRate = totalVisitors > 0 ? (totalConversions / totalVisitors) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalVisitors,
        totalPageViews,
        totalConversions,
        averageBounceRate: Math.round(averageBounceRate * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
        dailyData: trafficData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching traffic data',
      error: error.message
    });
  }
});

module.exports = {
  getAnalyticsDashboard,
  getSalesData,
  getRevenueMetrics,
  getProductPerformance,
  getCategoryPerformance,
  getCustomerInsights,
  getInventoryInsights,
  getTrafficData,
  computeAnalyticsSnapshot,
  // optionally export for reuse if needed elsewhere
  computePaymentStatusMetrics,
};