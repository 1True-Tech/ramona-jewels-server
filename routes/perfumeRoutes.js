const express = require('express');
const {
  getPerfumes,
  getPerfume,
  createPerfume,
  updatePerfume,
  deletePerfume,
  uploadPerfumeImages,
} = require('../controllers/perfumeController');
const { protect, authorize, optionalAuth } = require('../middlewares/auth');
const advancedResults = require('../middlewares/advancedResults');
const Perfume = require('../models/Products');

const router = express.Router({ mergeParams: true });

// Apply default in-stock filter for public listing unless user is admin
function applyInStockFilter(req, res, next) {
  // Allow admin to bypass the filter
  if (req.user && req.user.role === 'admin') return next();

  // Ensure only in-stock products are returned by default
  req.query.inStock = true;
  // Build nested operator so advancedResults converts to $gt
  req.query.stockCount = { gt: 0 };
  next();
}

/**
 * @swagger
 * tags:
 *   name: Perfumes
 *   description: The perfumes managing API
 */

/**
 * @swagger
 * /perfumes:
 *   get:
 *     summary: Get all perfumes
 *     tags: [Perfumes]
 *     parameters:
 *       - in: query
 *         name: select
 *         schema:
 *           type: string
 *         description: Fields to select (comma separated)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by fields (comma separated, prefix with - for descending)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of perfumes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 pagination:
 *                   type: object
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Perfume'
 *   post:
 *     summary: Create a new perfume
 *     tags: [Perfumes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Perfume'
 *     responses:
 *       201:
 *         description: Perfume created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Perfume'
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden (admin only)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router
  .route('/')
  .get(
    optionalAuth,
    applyInStockFilter,
    advancedResults(Perfume, {
      path: 'category',
      select: 'name description',
    }),
    getPerfumes
  )
  .post(protect, authorize('admin'), createPerfume);

// Upload images for perfumes
router.post('/upload-images', protect, authorize('admin'), uploadPerfumeImages);

router
  .route('/:id')
  .get(optionalAuth, getPerfume)
  .put(protect, authorize('admin'), updatePerfume)
  .delete(protect, authorize('admin'), deletePerfume);

module.exports = router;