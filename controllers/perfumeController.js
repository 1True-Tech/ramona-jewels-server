const Perfume = require('../models/Products');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');
const fs = require('fs');
const path = require('path');
const Category = require('../models/category');

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
  const body = { ...req.body };

  // Normalize strings
  const toString = (v) => (v === undefined || v === null ? v : String(v));

  // Ensure category provided
  if (!body.category) {
    return next(new ErrorResponse('Category is required', 400));
  }

  // Resolve category by id or name; store category name as per schema
  let categoryDoc = null;
  const cat = toString(body.category) || '';
  if (cat && /^[a-fA-F0-9]{24}$/.test(cat)) {
    categoryDoc = await Category.findById(cat);
  } else {
    categoryDoc = await Category.findOne({ name: cat });
  }
  if (!categoryDoc) {
    return next(new ErrorResponse('Category not found', 404));
  }
  body.category = categoryDoc.name; // schema stores category as string name

  // If images array provided but image single not set, set first image
  if (!body.image && Array.isArray(body.images) && body.images.length > 0) {
    body.image = body.images[0];
  }

  // Convert note fields from comma separated string to arrays if needed
  const toArray = (val) => {
    if (Array.isArray(val)) return val;
    if (val === undefined || val === null) return undefined;
    return String(val)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };
  const top = toArray(body.topNotes);
  const mid = toArray(body.middleNotes);
  const base = toArray(body.baseNotes);
  if (top !== undefined) body.topNotes = top;
  if (mid !== undefined) body.middleNotes = mid;
  if (base !== undefined) body.baseNotes = base;

  // Normalize gender and concentration to match enums
  const normGender = (g) => {
    if (!g) return g;
    const s = String(g).toLowerCase();
    if (['men', 'male', 'm'].includes(s)) return 'Men';
    if (['women', 'female', 'f'].includes(s)) return 'Women';
    if (['unisex', 'u'].includes(s)) return 'Unisex';
    return g; // let mongoose validate if mismatched
  };
  if (body.gender) body.gender = normGender(body.gender);

  const normConcentration = (c) => {
    if (!c) return c;
    const s = String(c).toUpperCase();
    if (['EDT', 'EDP', 'PARFUM', 'EDC'].includes(s)) return s === 'PARFUM' ? 'Parfum' : s;
    return c;
  };
  if (body.concentration) body.concentration = normConcentration(body.concentration);

  // Coerce numbers
  if (body.price !== undefined) body.price = Number(body.price);
  if (body.originalPrice !== undefined && body.originalPrice !== '') body.originalPrice = Number(body.originalPrice);
  if (body.stockCount !== undefined) body.stockCount = Number(body.stockCount);
  if (body.stock !== undefined && (body.stockCount === undefined || Number.isNaN(body.stockCount))) {
    body.stockCount = Number(body.stock);
  }

  // Only allow known fields
  const allowed = [
    'name',
    'brand',
    'price',
    'originalPrice',
    'image',
    'images',
    'rating',
    'reviews',
    'badge',
    'category',
    'size',
    'concentration',
    'topNotes',
    'middleNotes',
    'baseNotes',
    'description',
    'gender',
    'inStock',
    'stockCount',
  ];
  const createData = {};
  for (const key of allowed) {
    if (body[key] !== undefined) createData[key] = body[key];
  }

  const perfume = await Perfume.create(createData);

  // Increment category product count (best-effort)
  try {
    await Category.findByIdAndUpdate(categoryDoc._id, { $inc: { productCount: 1 } });
  } catch (e) {
    // ignore counter sync errors
  }

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

  // Decrement category product count (best-effort)
  try {
    if (perfume.category) {
      const catDoc = await Category.findOne({ name: perfume.category });
      if (catDoc) {
        await Category.findByIdAndUpdate(catDoc._id, { $inc: { productCount: -1 } });
      }
    }
  } catch (e) {
    // ignore counter sync errors
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