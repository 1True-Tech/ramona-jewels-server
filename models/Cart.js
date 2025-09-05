const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  perfume: {
    type: mongoose.Schema.ObjectId,
    ref: 'Perfume',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity can not be less than 1'],
    default: 1,
  },
  size: String,
  price: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
  total: {
    type: Number,
    default: 0,
  },
  itemCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Calculate total and itemCount before save
cartSchema.pre('save', function (next) {
  this.total = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);