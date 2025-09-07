const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    trim: true,
  },
  description: {
    type: String,
    required: false,
    default: '',
  },
  image: {
    type: String,
    required: false,
    default: '',
  },
  productType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductType',
    required: [true, 'Please provide a product type for this category'],
    index: true,
  },
  productCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure category name is unique within each product type
categorySchema.index({ name: 1, productType: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);