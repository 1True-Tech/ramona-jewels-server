const mongoose = require('mongoose');

const productTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product type name'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ProductType', productTypeSchema);