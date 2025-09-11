const express = require('express');
const {
  getAllOrders,
  getOrderStats,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  refundOrder,
  createOrder,
  createStripePaymentIntent,
  handleStripeWebhook,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middlewares/auth');
// Add asyncHandler and Order model for the user-specific orders endpoint
const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management API
 */

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of orders per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Order status filter
 *     responses:
 *       200:
 *         description: List of orders
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', protect, authorize('admin'), getAllOrders);

// User-specific orders endpoint (must be before '/:id')
router.get('/my-orders', protect, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search || '';
  const status = req.query.status;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  // Build query for current user
  const query = { userId: req.user.id };

  if (search) {
    query.$or = [
      { orderId: { $regex: search, $options: 'i' } },
      { 'items.name': { $regex: search, $options: 'i' } },
    ];
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  try {
    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('userId', 'name email')
      .populate('items.productId', 'name price image category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const transformedOrders = orders.map(order => ({
      id: order._id,
      userId: order.userId?._id,
      customerName: order.customerInfo?.name || order.userId?.name,
      customerEmail: order.customerInfo?.email || order.userId?.email,
      customerPhone: order.customerInfo?.phone,
      status: order.status,
      items: order.items.map(item => ({
        id: item._id,
        productId: item.productId?._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        image: item.productId?.image || item.image
      })),
      subtotal: order.subtotal,
      shipping: order.shipping,
      tax: order.tax,
      discount: order.discount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      trackingNumber: order.trackingNumber,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    res.json({ success: true, data: transformedOrders, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
  }
}));

router.get('/stats', protect, authorize('admin'), getOrderStats);
router.get('/:id', protect, getOrderById);

router.post('/', protect, createOrder);
router.post('/stripe/create-payment-intent', protect, createStripePaymentIntent);
router.patch('/:id/status', protect, authorize('admin'), updateOrderStatus);
router.patch('/:id/cancel', protect, cancelOrder);
router.post('/:id/refund', protect, authorize('admin'), refundOrder);

module.exports = router;