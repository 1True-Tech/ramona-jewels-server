const Perfume = require('../models/Products');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/async');


// @desc    Get user cart
// @route   GET /api/v1/cart
// @access  Private
exports.getCart = asyncHandler(async (req, res, next) => {
  let cart = await cart.findOne({ user: req.user.id }).populate({
    path: 'items.perfume',
    select: 'name brand price image inStock stockCount',
  });

  if (!cart) {
    cart = await cart.create({ user: req.user.id, items: [] });
  }

  res.status(200).json({
    success: true,
    data: cart,
  });
});

// @desc    Add item to cart
// @route   POST /api/v1/cart
// @access  Private
exports.addToCart = asyncHandler(async (req, res, next) => {
  const { perfumeId, quantity, size } = req.body;

  // Get perfume to add to cart
  const perfume = await Perfume.findById(perfumeId);

  if (!perfume) {
    return next(new ErrorResponse(`Perfume not found with id of ${perfumeId}`, 404));
  }

  // Check if perfume is in stock
  if (!perfume.inStock || perfume.stockCount < quantity) {
    return next(new ErrorResponse('Not enough stock available', 400));
  }

  // Find user's cart or create new one if doesn't exist
  let cart = await cart.findOne({ user: req.user.id });

  if (!cart) {
    cart = await cart.create({ user: req.user.id, items: [] });
  }

  // Check if item already exists in cart
  const itemIndex = cart.items.findIndex(
    (item) => item.perfume.toString() === perfumeId && item.size === size
  );

  if (itemIndex > -1) {
    // Update quantity if item exists
    cart.items[itemIndex].quantity += quantity;
  } else {
    // Add new item to cart
    cart.items.push({
      perfume: perfumeId,
      quantity,
      size,
      price: perfume.price,
      name: perfume.name,
      image: perfume.image,
    });
  }

  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

// @desc    Update cart item quantity
// @route   PUT /api/v1/cart/:itemId
// @access  Private
exports.updateCartItem = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;

  // Find user's cart
  const cart = await cart.findOne({ user: req.user.id });

  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }

  // Find item in cart
  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(new ErrorResponse('Item not found in cart', 404));
  }

  // Get perfume to check stock
  const perfume = await Perfume.findById(cart.items[itemIndex].perfume);

  if (!perfume) {
    return next(new ErrorResponse('Perfume not found', 404));
  }

  // Check if enough stock available
  if (quantity > perfume.stockCount) {
    return next(new ErrorResponse('Not enough stock available', 400));
  }

  // Update quantity
  cart.items[itemIndex].quantity = quantity;

  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/:itemId
// @access  Private
exports.removeFromCart = asyncHandler(async (req, res, next) => {
  // Find user's cart
  const cart = await cart.findOne({ user: req.user.id });

  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }

  // Find item in cart
  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(new ErrorResponse('Item not found in cart', 404));
  }

  // Remove item from cart
  cart.items.splice(itemIndex, 1);

  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private
exports.clearCart = asyncHandler(async (req, res, next) => {
  const cart = await cart.findOneAndUpdate(
    { user: req.user.id },
    { items: [], total: 0, itemCount: 0 },
    { new: true }
  );

  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }

  res.status(200).json({
    success: true,
    data: cart,
  });
});