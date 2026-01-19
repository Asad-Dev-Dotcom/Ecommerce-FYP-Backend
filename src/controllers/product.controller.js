import { isValidObjectId } from "mongoose";
import { Product } from "../models/product.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import {
  removeFromCloudinary,
  removeMultipleFromCloudinary,
  uploadMultipleOnCloudinary,
} from "../utils/cloudinary.js";

const createProduct = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!ownerId) {
    return next(new CustomError(401, "Unauthorized"));
  }

  const { name, description, price, category, stock, is_flash_sale, flash_sale_price, existingImages, is_featured } = req.body;
  const files = req.files;

  if (!name || !description || !price || !category || !stock) {
    return next(new CustomError(400, "Please provide all required fields"));
  }

  // Validate flash sale data
  if (is_flash_sale === 'true' && (!flash_sale_price || parseFloat(flash_sale_price) >= parseFloat(price))) {
    return next(new CustomError(400, "Flash sale price must be less than regular price"));
  }

  if (!files || files.length === 0) {
    return next(new CustomError(400, "Please provide at least one product image"));
  }

  // Upload images to Cloudinary
  const uploadedImages = await uploadMultipleOnCloudinary(files, "products");

  if (!uploadedImages || uploadedImages.length === 0) {
    return next(new CustomError(500, "Failed to upload images"));
  }

  // Prepare image data for database
  const images = uploadedImages.map(img => ({
    public_id: img.public_id,
    url: img.secure_url,
  }));

  const productData = {
    name,
    description,
    price: parseFloat(price),
    category,
    stock: parseInt(stock),
    images,
    owner: ownerId,
    is_featured: is_featured === 'true' || is_featured === true,
  };

  // Add flash sale data if provided
  if (is_flash_sale === 'true') {
    productData.is_flash_sale = true;
    productData.flash_sale_price = parseFloat(flash_sale_price);
    productData.flash_sale_start = new Date();
    productData.flash_sale_end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  }

  const newProduct = await Product.create(productData);

  res.status(201).json({
    success: true,
    message: "Product created successfully",
    data: newProduct,
  });
});

const getAllProducts = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, category, minPrice, maxPrice, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  // Build query object
  const query = {};

  // Category filter
  if (category) {
    query.category = { $regex: category, $options: 'i' };
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Search filter (name and description)
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Sorting
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query with filters, sorting and pagination
  const products = await Product.find(query)
    .populate('owner', 'name email')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / parseInt(limit));

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1,
    },
  });
});

const getOneProduct = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  if (!isValidObjectId(productId)) {
    return next(new CustomError(400, "Invalid product ID"));
  }
  const product = await Product.findById(productId).populate('owner', 'name email');
  if (!product) {
    return next(new CustomError(404, "Product not found"));
  }
  res.status(200).json({
    success: true,
    data: product,
  });
});

const getProductsByCategory = asyncHandler(async (req, res, next) => {
  const { categoryName } = req.params;
  const { page = 1, limit = 20, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  if (!categoryName) {
    return next(new CustomError(400, "Category name is required"));
  }

  // Build query object
  const query = {
    category: { $regex: categoryName, $options: 'i' }
  };

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Sorting
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const products = await Product.find(query)
    .populate('owner', 'name email')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / parseInt(limit));

  res.status(200).json({
    success: true,
    data: products,
    category: categoryName,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1,
    },
  });
});

const updateProduct = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const ownerId = req?.user?._id;
  if (!isValidObjectId(productId)) {
    return next(new CustomError(400, "Invalid product ID"));
  }
  if (!ownerId) {
    return next(new CustomError(401, "Unauthorized"));
  }

  const product = await Product.findById(productId);
  if (!product) {
    return next(new CustomError(404, "Product not found"));
  }
  if (product.owner.toString() !== ownerId.toString()) {
    return next(new CustomError(403, "Forbidden: You do not own this product"));
  }

  const { name, description, price, category, stock, is_flash_sale, flash_sale_price, existingImages, is_featured } = req.body;
  const files = req.files;

  // Update basic fields
  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = parseFloat(price);
  if (category !== undefined) product.category = category;
  if (stock !== undefined) product.stock = parseInt(stock);
  if (is_featured) product.is_featured = is_featured;

  // Handle flash sale updates
  if (is_flash_sale !== undefined) {
    if (is_flash_sale === 'true') {
      product.is_flash_sale = true;
      if (flash_sale_price && parseFloat(flash_sale_price) < product.price) {
        product.flash_sale_price = parseFloat(flash_sale_price);
        product.flash_sale_start = new Date();
        product.flash_sale_end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
    } else {
      product.is_flash_sale = false;
      product.flash_sale_price = undefined;
      product.flash_sale_start = undefined;
      product.flash_sale_end = undefined;
    }
  }

  // Handle image updates
  let finalImages = [];

  // Keep existing images if specified
  if (existingImages) {
    try {
      const existingImagesArray = JSON.parse(existingImages);
      finalImages = [...existingImagesArray];
    } catch (error) {
      console.log('Error parsing existing images:', error);
    }
  }

  // Add new uploaded images
  if (files && files.length > 0) {
    const uploadedImages = await uploadMultipleOnCloudinary(files, "products");

    if (!uploadedImages || uploadedImages.length === 0) {
      return next(new CustomError(500, "Failed to upload new images"));
    }

    // Add new images to existing ones
    const newImages = uploadedImages.map(img => ({
      public_id: img.public_id,
      url: img.secure_url,
    }));

    finalImages = [...finalImages, ...newImages];
  }

  // Update product images only if there are changes
  if (finalImages.length > 0) {
    product.images = finalImages;
  }

  await product.save();
  res.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: product,
  });
});
const deleteProduct = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const ownerId = req?.user?._id;
  if (!isValidObjectId(productId)) {
    return next(new CustomError(400, "Invalid product ID"));
  }
  if (!ownerId) {
    return next(new CustomError(401, "Unauthorized"));
  }
  const product = await Product.findById(productId);
  if (!product) {
    return next(new CustomError(404, "Product not found"));
  }
  if (product.owner.toString() !== ownerId.toString()) {
    return next(new CustomError(403, "Forbidden: You do not own this product"));
  }

  // Delete images from Cloudinary before deleting product
  if (product.images && product.images.length > 0) {
    const publicIds = product.images.map(img => img.public_id);
    await removeMultipleFromCloudinary(publicIds, "image");
  }

  await Product.findByIdAndDelete(productId);
  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  });
});

const getMyProducts = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!ownerId) {
    return next(new CustomError(401, "Unauthorized"));
  }

  const products = await Product.find({ owner: ownerId }).populate('owner', 'name email');
  res.status(200).json({
    success: true,
    data: products,
  });
});

export {
  createProduct,
  getAllProducts,
  getOneProduct,
  getMyProducts,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
};
