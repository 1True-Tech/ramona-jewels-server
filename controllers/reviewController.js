const Review = require('../models/Review');
const Perfume = require('../models/Products');
const asyncHandler = require('../utils/async');
const ErrorResponse = require('../utils/errorResponse');
const { getIO } = require('../config/socket');

// @desc    Get reviews for a product
// @route   GET /api/v1/perfumes/:id/reviews
// @access  Public
exports.getReviewsByProduct = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const reviews = await Review.find({ productId }).sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: reviews.length, data: reviews });
});

// @desc    Create a review for a product
// @route   POST /api/v1/perfumes/:id/reviews
// @access  Public (or Protected if needed)
exports.createReview = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const { rating, comment, name } = req.body;

  if (!rating) {
    return next(new ErrorResponse('Rating is required', 400));
  }

  const exists = await Perfume.findById(productId);
  if (!exists) {
    return next(new ErrorResponse('Product not found', 404));
  }

  const review = await Review.create({
    productId,
    rating: Number(rating),
    comment: comment || '',
    name: name || (req.user ? req.user.name : 'Anonymous'),
    userId: req.user ? req.user.id : undefined,
  });

  // Update product aggregate fields (best-effort)
  try {
    const stats = await Review.aggregate([
      { $match: { productId: exists._id } },
      { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, total: { $sum: 1 } } },
    ]);
    const avgRating = stats[0]?.avgRating || 0;
    const total = stats[0]?.total || 0;
    await Perfume.findByIdAndUpdate(productId, { rating: avgRating, reviews: total });
  } catch (e) {
    // ignore aggregation errors
  }

  // Emit real-time event to product room
  try {
    const io = getIO();
    io.to(`product:${productId}`).emit('review:new', { review });
  } catch (e) {
    // socket not initialized or other issue; ignore
  }

  res.status(201).json({ success: true, data: review });
});