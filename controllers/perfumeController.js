const Perfume = require('../models/Perfume');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');

// @desc    Get all perfumes
// @route   GET /api/v1/perfumes
// @route   GET /api/v1/categories/:categoryId/perfumes
// @access  Public
exports.getPerfumes = asyncHandler(async (req, res, next) => {
  if (req.params.categoryId) {
    const perfumes = await Perfume.find({ category: req.params.categoryId });

    return res.status(200).json({
      success: true,
      count: perfumes.length,
      data: perfumes,
    });
  } else {
    res.status(200).json(res.advancedResults);
  }
});

// @desc    Get single perfume
// @route   GET /api/v1/perfumes/:id
// @access  Public
exports.getPerfume = asyncHandler(async (req, res, next) => {
  const perfume = await Perfume.findById(req.params.id);

  if (!perfume) {
    return next(
      new ErrorResponse(`Perfume not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: perfume,
  });
});

// @desc    Create new perfume
// @route   POST /api/v1/perfumes
// @access  Private/Admin
exports.createPerfume = asyncHandler(async (req, res, next) => {
  const perfume = await Perfume.create(req.body);

  res.status(201).json({
    success: true,
    data: perfume,
  });
});

// @desc    Update perfume
// @route   PUT /api/v1/perfumes/:id
// @access  Private/Admin
exports.updatePerfume = asyncHandler(async (req, res, next) => {
  const perfume = await Perfume.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!perfume) {
    return next(
      new ErrorResponse(`Perfume not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: perfume,
  });
});

// @desc    Delete perfume
// @route   DELETE /api/v1/perfumes/:id
// @access  Private/Admin
exports.deletePerfume = asyncHandler(async (req, res, next) => {
  const perfume = await Perfume.findByIdAndDelete(req.params.id);

  if (!perfume) {
    return next(
      new ErrorResponse(`Perfume not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});