const express = require('express');
const { getReviewsByProduct, createReview, getRandomReviews } = require('../controllers/reviewController');
const { protect } = require('../middlewares/auth');

const router = express.Router({ mergeParams: true });

// Public get reviews, authenticated create (can change to public if desired)
router.get('/perfumes/:id/reviews', getReviewsByProduct);
router.post('/perfumes/:id/reviews', protect, createReview);

// Public: random reviews across all products (limit via ?limit=3)
router.get('/perfumes/reviews/random', getRandomReviews);

module.exports = router;