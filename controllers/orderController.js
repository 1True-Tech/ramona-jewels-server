const Order = require('../models/Order');
const Perfume = require('../models/Products');
const User = require('../models/User');
const Cart = require('../models/Cart');
const asyncHandler = require('express-async-handler');
const { emitAnalyticsUpdate, emitOrderPaymentUpdate } = require('../config/socket');
const { computeAnalyticsSnapshot } = require('./analyticsController');
const fetch = require('node-fetch')

// Stripe setup
let stripe = null
try {
  const Stripe = require('stripe')
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
} catch (_) {
  // Stripe not installed or no key; endpoints will guard against null
}

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

    // Normalize addresses to match schema
    const fallback = { name: customerInfo?.name || req.user.name, phone: customerInfo?.phone || req.user.phone }
    const normalizedShipping = normalizeAddress(shippingAddress, fallback)
    const normalizedBilling = normalizeAddress(billingAddress, fallback) || normalizedShipping

    if (!isAddressComplete(normalizedShipping)) {
      return res.status(400).json({ success: false, message: 'Shipping address incomplete: name, street, city, state, zipCode, country are required.' })
    }

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
      shippingAddress: normalizedShipping,
      billingAddress: normalizedBilling,
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

    // Emit analytics snapshot after order creation
    try {
      const snapshot = await computeAnalyticsSnapshot();
      emitAnalyticsUpdate(snapshot);
    } catch (_) {}

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

    // Emit analytics snapshot after status update
    try {
      const snapshot = await computeAnalyticsSnapshot();
      emitAnalyticsUpdate(snapshot);
    } catch (_) {}

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

    // Emit analytics snapshot after cancellation
    try {
      const snapshot = await computeAnalyticsSnapshot();
      emitAnalyticsUpdate(snapshot);
    } catch (_) {}

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

    // Emit analytics snapshot after refund
    try {
      const snapshot = await computeAnalyticsSnapshot();
      emitAnalyticsUpdate(snapshot);
    } catch (_) {}

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

// --- Stripe Integration ---

// Helper to compute shipping consistent with frontend
function computeShipping(subtotal, shippingMethod) {
  if (shippingMethod === 'express') return 15.99
  if (shippingMethod === 'overnight') return 29.99
  // standard
  return subtotal > 100 ? 0 : 9.99
}

// Build order items and totals (shared by order creators)
async function buildItemsAndTotals(items, shippingMethod) {
  let subtotal = 0
  const orderItems = []

  for (const item of items) {
    const perfume = await Perfume.findById(item.productId)
    if (!perfume) {
      const err = new Error(`Perfume ${item.productId} not found`)
      err.statusCode = 404
      throw err
    }
    const itemTotal = perfume.price * item.quantity
    subtotal += itemTotal
    orderItems.push({
      productId: perfume._id,
      name: perfume.name,
      price: perfume.price,
      quantity: item.quantity,
      color: item.color,
      size: item.size || perfume.size,
      image: perfume.image,
    })
  }

  const shipping = computeShipping(subtotal, shippingMethod)
  const tax = subtotal * 0.08
  const total = subtotal + shipping + tax
  return { orderItems, subtotal, shipping, tax, total }
}

// Normalize address payload coming from client to match addressSchema
function normalizeAddress(addr, fallback = {}) {
  if (!addr || typeof addr !== 'object') return null
  const nameFromParts = [addr.firstName, addr.lastName].filter(Boolean).join(' ')
  const normalized = {
    name: addr.name || nameFromParts || fallback.name,
    street: addr.street || addr.address,
    city: addr.city || fallback.city,
    state: addr.state || fallback.state,
    zipCode: addr.zipCode || addr.postalCode || addr.zip,
    country: addr.country || fallback.country,
    phone: addr.phone || fallback.phone,
  }
  return normalized
}

function isAddressComplete(a) {
  return !!(a && a.name && a.street && a.city && a.state && a.zipCode && a.country)
}

// Create a unique, human-readable orderId field
async function generateReadableOrderId() {
  const orderCount = await Order.countDocuments()
  return `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`
}

// @desc    Create Stripe PaymentIntent and pending order
// @route   POST /api/v1/orders/stripe/create-payment-intent
// @access  Private
const createStripePaymentIntent = asyncHandler(async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ success: false, message: 'Stripe not configured' })
  }

  // Enforce settings: Stripe payments must be enabled
  try {
    const Settings = require('../models/Settings');
    const settings = await Settings.getSingleton();
    if (!settings?.payments?.stripe?.enabled) {
      return res.status(403).json({ success: false, message: 'Stripe payments are currently disabled by admin' });
    }
  } catch (_) {
    // If settings model not available, proceed (fails open)
  }

  const {
    items,
    shippingAddress,
    billingAddress,
    paymentMethod = 'stripe',
    customerInfo,
    notes,
    shippingMethod = 'standard',
  } = req.body || {}

  if (!items || !items.length) {
    return res.status(400).json({ success: false, message: 'No order items provided' })
  }

  // Build items and totals
  const { orderItems, subtotal, shipping, tax, total } = await buildItemsAndTotals(items, shippingMethod)

  // Normalize addresses to match schema
  const fallback = { name: customerInfo?.name || req.user.name, phone: customerInfo?.phone || req.user.phone }
  const normalizedShipping = normalizeAddress(shippingAddress, fallback)
  const normalizedBilling = normalizeAddress(billingAddress, fallback) || normalizedShipping

  if (!isAddressComplete(normalizedShipping)) {
    return res.status(400).json({ success: false, message: 'Shipping address incomplete: name, street, city, state, zipCode, country are required.' })
  }

  // Create PaymentIntent in cents
  const amount = Math.round(total * 100)
  const readableOrderId = await generateReadableOrderId()

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      orderId: readableOrderId,
      userId: req.user.id,
    },
  })

  // Create pending order linked to PaymentIntent
  const order = await Order.create({
    orderId: readableOrderId,
    userId: req.user.id,
    items: orderItems,
    subtotal,
    shipping,
    tax,
    total,
    paymentMethod,
    paymentStatus: 'pending',
    paymentId: paymentIntent.id,
    shippingAddress: normalizedShipping,
    billingAddress: normalizedBilling,
    customerInfo: customerInfo || {
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
    },
    notes,
    status: 'pending',
  })

  return res.status(200).json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      orderId: order._id,
      readableOrderId,
      amount,
    },
    message: 'Payment intent created',
  })
})

// @desc    Stripe webhook handler
// @route   POST /api/v1/stripe/webhook (raw body)
// @access  Public (Stripe only)
async function handleStripeWebhook(req, res) {
  if (!stripe) {
    return res.status(500).send('Stripe not configured')
  }

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return res.status(500).send('Webhook secret not configured')
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        const order = await Order.findOne({ paymentId: pi.id })
        if (order) {
          order.paymentStatus = 'paid'
          // Move to processing once paid
          order.status = order.status === 'pending' ? 'processing' : order.status
          await order.save()
          // Clear user cart
          try { await Cart.findOneAndUpdate({ user: order.userId }, { $set: { items: [] } }) } catch (_) {}
          // Emit realtime order payment update using helper
          try {
            emitOrderPaymentUpdate(String(order._id), {
              orderId: String(order._id),
              paymentStatus: order.paymentStatus,
              status: order.status,
            })
          } catch (_) {}
          // Emit analytics snapshot after payment success
          try {
            const snapshot = await computeAnalyticsSnapshot();
            emitAnalyticsUpdate(snapshot);
          } catch (_) {}
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        const order = await Order.findOne({ paymentId: pi.id })
        if (order) {
          order.paymentStatus = 'failed'
          await order.save()
          try {
            emitOrderPaymentUpdate(String(order._id), {
              orderId: String(order._id),
              paymentStatus: order.paymentStatus,
              status: order.status,
            })
          } catch (_) {}
          // Emit analytics snapshot after payment failure
          try {
            const snapshot = await computeAnalyticsSnapshot();
            emitAnalyticsUpdate(snapshot);
          } catch (_) {}
        }
        break
      }
      default:
        // ignore other events for now
        break
    }

    res.status(200).json({ received: true })
  } catch (err) {
    res.status(500).send(`Webhook handler error: ${err.message}`)
  }
}

// Helper: PayPal configuration and token retrieval
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ''
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ''
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
const PAYPAL_API_BASE = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal client credentials not configured')
  }
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`PayPal token error: ${res.status} ${txt}`)
  }
  const data = await res.json()
  return data.access_token
}

// Create PayPal Order and pending DB order
const createPayPalOrder = asyncHandler(async (req, res) => {
  try {
    // Optional settings gate similar to Stripe
    try {
      const Settings = require('../models/Settings');
      const settings = await Settings.getSingleton();
      if (settings?.payments && settings.payments.paypal && settings.payments.paypal.enabled === false) {
        return res.status(403).json({ success: false, message: 'PayPal payments are currently disabled by admin' })
      }
    } catch (_) {}

    const {
      items,
      shippingAddress,
      billingAddress,
      customerInfo,
      notes,
      shippingMethod = 'standard',
    } = req.body || {}

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'No order items provided' })
    }

    // Build items and totals using existing helpers
    const { orderItems, subtotal, shipping, tax, total } = await buildItemsAndTotals(items, shippingMethod)

    const fallback = { name: customerInfo?.name || req.user.name, phone: customerInfo?.phone || req.user.phone }
    const normalizedShipping = normalizeAddress(shippingAddress, fallback)
    const normalizedBilling = normalizeAddress(billingAddress, fallback) || normalizedShipping
    if (!isAddressComplete(normalizedShipping)) {
      return res.status(400).json({ success: false, message: 'Shipping address incomplete: name, street, city, state, zipCode, country are required.' })
    }

    const accessToken = await getPayPalAccessToken()
    const readableOrderId = await generateReadableOrderId()

    const amount = {
      currency_code: 'USD',
      value: total.toFixed(2),
      breakdown: {
        item_total: { currency_code: 'USD', value: subtotal.toFixed(2) },
        shipping: { currency_code: 'USD', value: shipping.toFixed(2) },
        tax_total: { currency_code: 'USD', value: tax.toFixed(2) },
      },
    }

    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: readableOrderId,
          amount,
        },
      ],
      application_context: {
        brand_name: 'Ramona Jewels',
        user_action: 'PAY_NOW',
      },
    }

    const ppRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody),
    })

    if (!ppRes.ok) {
      const text = await ppRes.text()
      return res.status(500).json({ success: false, message: `Failed to create PayPal order: ${text}` })
    }

    const ppOrder = await ppRes.json()
    const approvalLink = (ppOrder.links || []).find((l) => l.rel === 'approve')?.href

    // Create pending order in DB linked to PayPal order id
    const order = await Order.create({
      orderId: readableOrderId,
      userId: req.user.id,
      items: orderItems,
      subtotal,
      shipping,
      tax,
      total,
      paymentMethod: 'paypal',
      paymentStatus: 'pending',
      paymentId: ppOrder.id,
      shippingAddress: normalizedShipping,
      billingAddress: normalizedBilling,
      customerInfo: customerInfo || {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
      },
      notes,
      status: 'pending',
    })

    return res.status(200).json({
      success: true,
      data: {
        paypalOrderId: ppOrder.id,
        approveLink: approvalLink,
        orderId: order._id,
        readableOrderId,
        amount: Math.round(total * 100),
      },
      message: 'PayPal order created',
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error creating PayPal order' })
  }
})

// Capture PayPal Order and update DB order
const capturePayPalOrder = asyncHandler(async (req, res) => {
  try {
    const { paypalOrderId } = req.body || {}
    if (!paypalOrderId) {
      return res.status(400).json({ success: false, message: 'paypalOrderId is required' })
    }

    const accessToken = await getPayPalAccessToken()
    const capRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const capJson = await capRes.json().catch(() => ({}))
    if (!capRes.ok) {
      return res.status(500).json({ success: false, message: `PayPal capture failed`, data: capJson })
    }

    const status = capJson.status || capJson?.purchase_units?.[0]?.payments?.captures?.[0]?.status
    const isCompleted = String(status).toUpperCase() === 'COMPLETED'

    // Find related order by paymentId
    const order = await Order.findOne({ paymentId: paypalOrderId, userId: req.user.id })
    if (!order) {
      return res.status(404).json({ success: false, message: 'Related order not found' })
    }

    if (isCompleted) {
      order.paymentStatus = 'paid'
      if (order.status === 'pending') order.status = 'processing'
      await order.save()
      // Clear user cart
      try { await Cart.findOneAndUpdate({ user: order.userId }, { $set: { items: [] } }) } catch (_) {}
      // Emit realtime update
      try {
        emitOrderPaymentUpdate(String(order._id), {
          orderId: String(order._id),
          paymentStatus: order.paymentStatus,
          status: order.status,
        })
      } catch (_) {}
      // Analytics snapshot
      try {
        const snapshot = await computeAnalyticsSnapshot();
        emitAnalyticsUpdate(snapshot);
      } catch (_) {}
    } else {
      order.paymentStatus = 'failed'
      await order.save()
      try {
        emitOrderPaymentUpdate(String(order._id), {
          orderId: String(order._id),
          paymentStatus: order.paymentStatus,
          status: order.status,
        })
      } catch (_) {}
    }

    return res.status(200).json({ success: true, data: { orderId: String(order._id), status: order.status, paymentStatus: order.paymentStatus, paypal: capJson } })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error capturing PayPal order' })
  }
})

// Final exports moved to the end to avoid referencing before initialization
module.exports = {
  getAllOrders,
  getOrderStats,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  refundOrder,
  createStripePaymentIntent,
  handleStripeWebhook,
  createPayPalOrder,
  capturePayPalOrder,
}