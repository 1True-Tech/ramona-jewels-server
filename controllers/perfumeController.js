const Perfume = require('../models/Perfume');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const fs = require('fs');
const path = require('path');

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

// @desc    Upload perfume images
// @route   POST /api/v1/perfumes/upload-images
// @access  Private/Admin
exports.uploadPerfumeImages = asyncHandler(async (req, res, next) => {
  if (!req.files || !req.files.images) {
    return next(new ErrorResponse('Please upload image files under the "images" field', 400));
  }

  const maxSize = Number(process.env.MAX_FILE_UPLOAD) || 5000000; // 5MB default
  const uploadDir = path.join(__dirname, '../public/uploads/products');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
  const urls = [];

  for (const file of files) {
    if (!file.mimetype.startsWith('image')) {
      return next(new ErrorResponse('Please upload only image files', 400));
    }
    if (file.size > maxSize) {
      return next(new ErrorResponse(`Please upload images less than ${Math.round(maxSize / 1000000)}MB`, 400));
    }

    const ext = path.parse(file.name).ext;
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const filename = `product_${unique}${ext}`;
    const filePath = path.join(uploadDir, filename);

    await new Promise((resolve, reject) => {
      file.mv(filePath, (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });

    urls.push(`/uploads/products/${filename}`);
  }

  res.status(200).json({
    success: true,
    data: { urls },
  });
});