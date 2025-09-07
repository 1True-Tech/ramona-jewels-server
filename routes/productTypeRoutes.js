const express = require('express');
const { protect, authorize } = require('../middlewares/auth');
const {
  getProductTypes,
  getProductType,
  createProductType,
  updateProductType,
  deleteProductType,
} = require('../controllers/productTypeController');

const router = express.Router();

router.route('/')
  .get(getProductTypes)
  .post(protect, authorize('admin'), createProductType);

router.route('/:id')
  .get(getProductType)
  .put(protect, authorize('admin'), updateProductType)
  .delete(protect, authorize('admin'), deleteProductType);

module.exports = router;