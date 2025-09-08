const express = require('express');
const { getReviewsByProduct, createReview } = require('../controllers/reviewController');
const { protect } = require('../middlewares/auth');

const router = express.Router({ mergeParams: true });

// Public get reviews, authenticated create (can change to public if desired)
router.get('/perfumes/:id/reviews', getReviewsByProduct);
router.post('/perfumes/:id/reviews', protect, createReview);

module.exports = router;