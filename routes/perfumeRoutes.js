const express = require('express');
const {
  getPerfumes,
  getPerfume,
  createPerfume,
  updatePerfume,
  deletePerfume,
} = require('../controllers/perfumeController');
const { protect, authorize } = require('../middlewares/auth');
const advancedResults = require('../middlewares/advancedResults');
const Perfume = require('../models/Perfume');

const router = express.Router({ mergeParams: true });

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
    advancedResults(Perfume, {
      path: 'category',
      select: 'name description',
    }),
    getPerfumes
  )
  .post(protect, authorize('admin'), createPerfume);

/**
 * @swagger
 * /perfumes/{id}:
 *   get:
 *     summary: Get a perfume by ID
 *     tags: [Perfumes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Perfume ID
 *     responses:
 *       200:
 *         description: Perfume data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Perfume'
 *       404:
 *         description: Perfume not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update a perfume
 *     tags: [Perfumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Perfume ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Perfume'
 *     responses:
 *       200:
 *         description: Perfume updated successfully
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
 *       404:
 *         description: Perfume not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Delete a perfume
 *     tags: [Perfumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Perfume ID
 *     responses:
 *       200:
 *         description: Perfume deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
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
 *       404:
 *         description: Perfume not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router
  .route('/:id')
  .get(getPerfume)
  .put(protect, authorize('admin'), updatePerfume)
  .delete(protect, authorize('admin'), deletePerfume);

module.exports = router;