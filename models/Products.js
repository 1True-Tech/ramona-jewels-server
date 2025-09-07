const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
  },
  brand: {
    type: String,
    required: [true, 'Please add a brand'],
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
  },
  originalPrice: Number,
  image: {
    type: String,
    required: [true, 'Please add an image'],
  },
  images: [String],
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating must can not be more than 5'],
  },
  reviews: Number,
  badge: String,
  category: {
    type: String,
    required: [true, 'Please add a category'],
  },
  size: {
    type: String,
  },
  concentration: {
    type: String,
    enum: ['EDT', 'EDP', 'Parfum', 'EDC'],
  },
  topNotes: [String],
  middleNotes: [String],
  baseNotes: [String],
  description: {
    type: String,
    required: [true, 'Please add a description'],
  },
  gender: {
    type: String,
    enum: ['Men', 'Women', 'Unisex'],
    // required: [true, 'Please specify gender'],
  },
  inStock: {
    type: Boolean,
    default: true,
  },
  stockCount: {
    type: Number,
    required: [true, 'Please add stock count'],
    min: [0, 'Stock count cannot be negative'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Products', productSchema);