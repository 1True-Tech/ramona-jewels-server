const mongoose = require('mongoose')

const ReturnItemSchema = new mongoose.Schema({
  orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Perfume' },
  name: String,
  price: Number,
  quantity: { type: Number, default: 1 },
  reason: { type: String, default: '' },
}, { _id: false })

const ReturnRequestSchema = new mongoose.Schema({
  rmaNumber: { type: String, required: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [ReturnItemSchema], default: [] },
  status: { 
    type: String, 
    enum: ['requested', 'approved', 'in_transit', 'received', 'refunded', 'rejected'],
    default: 'requested'
  },
  reason: { type: String, default: '' },
  comments: { type: String, default: '' },
  refundAmount: { type: Number, default: 0 },
  carrier: { type: String },
  trackingNumber: { type: String },
}, { timestamps: true })

module.exports = mongoose.model('ReturnRequest', ReturnRequestSchema)