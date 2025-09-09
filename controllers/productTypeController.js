const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const ProductType = require('../models/ProductType');
const Category = require('../models/category');

// @desc    Get all product types
// @route   GET /api/v1/product-types
// @access  Public
exports.getProductTypes = asyncHandler(async (req, res, next) => {
  const types = await ProductType.find().sort('-createdAt');
  res.status(200).json({ success: true, count: types.length, data: types });
});

// @desc    Get single product type
// @route   GET /api/v1/product-types/:id
// @access  Public
exports.getProductType = asyncHandler(async (req, res, next) => {
  const type = await ProductType.findById(req.params.id);
  if (!type) return next(new ErrorResponse('Product type not found', 404));
  res.status(200).json({ success: true, data: type });
});

// @desc    Create product type
// @route   POST /api/v1/product-types
// @access  Private/Admin
exports.createProductType = asyncHandler(async (req, res, next) => {
  const type = await ProductType.create(req.body);
  res.status(201).json({ success: true, data: type });
});

// @desc    Update product type
// @route   PUT /api/v1/product-types/:id
// @access  Private/Admin
exports.updateProductType = asyncHandler(async (req, res, next) => {
  const type = await ProductType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!type) return next(new ErrorResponse('Product type not found', 404));
  res.status(200).json({ success: true, data: type });
});

// @desc    Delete product type (also deletes its categories)
// @route   DELETE /api/v1/product-types/:id
// @access  Private/Admin
exports.deleteProductType = asyncHandler(async (req, res, next) => {
  const type = await ProductType.findById(req.params.id);
  if (!type) return next(new ErrorResponse('Product type not found', 404));

  // Cascade delete: remove all categories linked to this product type first
  const { deletedCount } = await Category.deleteMany({ productType: req.params.id });

  await ProductType.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: `Product type deleted. Removed ${deletedCount} categories.`, data: {} });
});