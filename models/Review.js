const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5'],
      required: [true, 'Please add a rating'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comment cannot be more than 2000 characters'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);