const asyncHandler = require('express-async-handler')
const Order = require('../models/Order')
const ReturnRequest = require('../models/ReturnRequest')
const { emitReturnUpdate } = require('../config/socket')

function generateRMA() {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 6)
  return `RMA-${ts}-${rand}`.toUpperCase()
}

// POST /api/v1/returns
// Create a return request for an order (user)
exports.createReturnRequest = asyncHandler(async (req, res) => {
  const { orderId, items = [], reason = '', comments = '' } = req.body

  const order = await Order.findById(orderId)
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' })
  }
  // Only owner or admin can request
  if (order.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized to request return for this order' })
  }

  // Calculate default items if none provided: full order items
  let returnItems = items
  if (!items || items.length === 0) {
    returnItems = order.items.map(it => ({
      orderItemId: it._id,
      productId: it.productId,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      reason: reason || 'No reason provided'
    }))
  }

  const rmaNumber = generateRMA()
  const rr = await ReturnRequest.create({
    rmaNumber,
    orderId: order._id,
    userId: order.userId,
    items: returnItems,
    status: 'requested',
    reason,
    comments,
    refundAmount: 0,
  })

  try { emitReturnUpdate(String(rr._id), { id: String(rr._id), status: rr.status, rmaNumber: rr.rmaNumber }) } catch (_) {}

  res.status(201).json({ success: true, data: rr, message: 'Return request created' })
})

// GET /api/v1/returns/my - list user's return requests
exports.getMyReturns = asyncHandler(async (req, res) => {
  const returns = await ReturnRequest.find({ userId: req.user.id }).sort({ createdAt: -1 })
  res.json({ success: true, data: returns })
})

// GET /api/v1/returns/:id - get a single return request (owner or admin)
exports.getReturnById = asyncHandler(async (req, res) => {
  const rr = await ReturnRequest.findById(req.params.id)
  if (!rr) return res.status(404).json({ success: false, message: 'Return request not found' })

  if (rr.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' })
  }

  res.json({ success: true, data: rr })
})

// PATCH /api/v1/returns/:id/status - admin updates return status or add tracking
exports.updateReturnStatus = asyncHandler(async (req, res) => {
  const { status, refundAmount, carrier, trackingNumber } = req.body
  const rr = await ReturnRequest.findById(req.params.id)
  if (!rr) return res.status(404).json({ success: false, message: 'Return request not found' })

  // Only admin can change status
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin only' })
  }

  if (status) rr.status = status
  if (refundAmount !== undefined) rr.refundAmount = refundAmount
  if (carrier) rr.carrier = carrier
  if (trackingNumber) rr.trackingNumber = trackingNumber
  await rr.save()

  // Optionally, update linked order payment status when refunded
  if (status === 'refunded') {
    try {
      const order = await Order.findById(rr.orderId)
      if (order) {
        order.paymentStatus = 'refunded'
        await order.save()
      }
    } catch (_) {}
  }

  try { emitReturnUpdate(String(rr._id), { id: String(rr._id), status: rr.status, refundAmount: rr.refundAmount }) } catch (_) {}

  res.json({ success: true, data: rr, message: 'Return status updated' })
})