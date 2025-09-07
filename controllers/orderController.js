const Order = require('../models/Order');
const Perfume = require('../models/Products');
const User = require('../models/User');
// const Cart = require('../models/Cart');
const asyncHandler = require('express-async-handler');

// @desc    Get all orders with pagination and filtering
// @route   GET /api/admin/orders
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search || '';
  const status = req.query.status;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  // Build query
  let query = {};

  // Search functionality
  if (search) {
    query.$or = [
      { orderId: { $regex: search, $options: 'i' } },
      { 'customerInfo.name': { $regex: search, $options: 'i' } },
      { 'customerInfo.email': { $regex: search, $options: 'i' } },
    ];
  }

  // Status filter
  if (status && status !== 'all') {
    query.status = status;
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  try {
    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('userId', 'name email')
      .populate('items.productId', 'name price image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Transform orders to match frontend interface
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

    res.json({
      success: true,
      data: transformedOrders,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// @desc    Get order statistics
// @route   GET /api/admin/orders/stats
// @access  Private/Admin
const getOrderStats = asyncHandler(async (req, res) => {
  try {
    const total = await Order.countDocuments();
    const pending = await Order.countDocuments({ status: 'pending' });
    const processing = await Order.countDocuments({ status: 'processing' });
    const shipped = await Order.countDocuments({ status: 'shipped' });
    const delivered = await Order.countDocuments({ status: 'delivered' });
    const cancelled = await Order.countDocuments({ status: 'cancelled' });

    // Calculate total revenue
    const revenueResult = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // Calculate average order value
    const completedOrders = await Order.countDocuments({ 
      status: { $in: ['delivered', 'shipped', 'processing'] } 
    });
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    res.json({
      success: true,
      data: {
        total,
        pending,
        processing,
        shipped,
        delivered,
        cancelled,
        totalRevenue,
        averageOrderValue
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order statistics',
      error: error.message
    });
  }
});

// @desc    Get single order
// @route   GET /api/admin/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('items.productId', 'name price image category');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.userId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }

    const transformedOrder = {
      id: order._id,
      userId: order.userId._id,
      customerName: order.customerInfo?.name || order.userId.name,
      customerEmail: order.customerInfo?.email || order.userId.email,
      customerPhone: order.customerInfo?.phone || order.userId.phone,
      status: order.status,
      items: order.items.map(item => ({
        id: item._id,
        productId: item.productId._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        image: item.productId.image || item.image
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
    };

    res.json({
      success: true,
      data: transformedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const {
    items,
    shippingAddress,
    billingAddress,
    paymentMethod,
    customerInfo,
    notes
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No order items provided'
    });
  }

  try {
    // Calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const perfume = await Perfume.findById(item.productId);
      if (!perfume) {
        return res.status(404).json({
          success: false,
          message: `Perfume ${item.productId} not found`
        });
      }

      const itemTotal = perfume.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: perfume._id,
        name: perfume.name,
        price: perfume.price,
        quantity: item.quantity,
        color: item.color,
        size: item.size || perfume.size,
        image: perfume.image
      });
    }

    const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + shipping + tax;

    // Generate order ID
    const orderCount = await Order.countDocuments();
    const orderId = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

    const order = await Order.create({
      orderId,
      userId: req.user.id,
      items: orderItems,
      subtotal,
      shipping,
      tax,
      total,
      paymentMethod,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      customerInfo: customerInfo || {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone
      },
      notes,
      status: 'pending',
      paymentStatus: 'pending'
    });

    // Clear user's cart after successful order
    await Cart.findOneAndUpdate(
      { user: req.user.id },
      { $set: { items: [] } }
    );

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
});

// @desc    Update order status
// @route   PATCH /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, trackingNumber, notes } = req.body;

  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const updateData = { status };
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (notes) updateData.notes = notes;

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
});

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.status = 'cancelled';
    order.paymentStatus = 'refunded';
    await order.save();

    res.json({
      success: true,
      data: order,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling order',
      error: error.message
    });
  }
});

// @desc    Refund order
// @route   POST /api/admin/orders/:id/refund
// @access  Private/Admin
const refundOrder = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;

  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order with refund information
    order.paymentStatus = 'refunded';
    order.refund = {
      amount: amount || order.total,
      reason: reason || 'Admin refund',
      processedAt: new Date(),
      processedBy: req.user.id
    };

    await order.save();

    res.json({
      success: true,
      data: order,
      message: 'Order refunded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing refund',
      error: error.message
    });
  }
});

module.exports = {
  getAllOrders,
  getOrderStats,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  refundOrder
};