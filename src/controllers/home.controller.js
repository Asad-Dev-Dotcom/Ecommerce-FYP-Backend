import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { Category } from "../models/category.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";

// Search products
const searchProducts = asyncHandler(async (req, res, next) => {
  const { q, category, minPrice, maxPrice, page = 1, limit = 20 } = req.query;

  const query = {};

  // Text search
  if (q) {
    query.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
    ];
  }

  // Category filter
  if (category) {
    query.category = { $regex: category, $options: "i" };
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  const skip = (page - 1) * limit;

  const products = await Product.find(query)
    .populate("owner", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

// Get top 5 categories for left banner
const getTopCategories = asyncHandler(async (req, res, next) => {
  try {
    const categories = await Category.find()
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching top categories:', error);
    // Return fallback categories if database query fails
    const fallbackCategories = [
      { _id: '1', title: 'Electronics', description: 'Electronic devices and gadgets' },
      { _id: '2', title: 'Clothing', description: 'Fashion and apparel' },
      { _id: '3', title: 'Home & Garden', description: 'Home improvement and garden supplies' },
      { _id: '4', title: 'Sports & Outdoors', description: 'Sports equipment and outdoor gear' },
      { _id: '5', title: 'Books', description: 'Books and publications' },
    ];

    res.status(200).json({
      success: true,
      data: fallbackCategories,
    });
  }
});

// Get flash sale products
const getFlashSaleProducts = asyncHandler(async (req, res, next) => {
  const currentDate = new Date();

  const flashSaleProducts = await Product.find({
    is_flash_sale: true,
    flash_sale_start: { $lte: currentDate },
    flash_sale_end: { $gte: currentDate },
    stock: { $gt: 0 },
  })
    .populate("owner", "name")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: flashSaleProducts,
  });
});

// Get all flash sale products with pagination
const getAllFlashSaleProducts = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const currentDate = new Date();

  const query = {
    is_flash_sale: true,
    flash_sale_start: { $lte: currentDate },
    flash_sale_end: { $gte: currentDate },
    stock: { $gt: 0 },
  };

  const skip = (page - 1) * limit;

  const products = await Product.find(query)
    .populate("owner", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

// Get best selling products
const getBestSellingProducts = asyncHandler(async (req, res, next) => {
  try {
    // For now, just return some products sorted by creation date
    // In a real implementation, this would use order aggregation
    const products = await Product.find({
      stock: { $gt: 0 }
    })
    .limit(10)
    .sort({ createdAt: -1 });

    // Add mock totalSold for demo purposes
    const productsWithTotalSold = products.map(product => ({
      ...product.toObject(),
      totalSold: Math.floor(Math.random() * 50) + 1, // Random sales for demo
    }));

    res.status(200).json({
      success: true,
      data: productsWithTotalSold,
    });
  } catch (error) {
    console.error('Error fetching best selling products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch best selling products',
    });
  }
});

// Get all best selling products with pagination
const getAllBestSellingProducts = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (page - 1) * limit;

  const bestSellingProducts = await Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalSold: { $sum: "$items.quantity" },
      },
    },
    { $sort: { totalSold: -1 } },
    { $skip: skip },
    { $limit: parseInt(limit) },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $match: {
        "product.0": { $exists: true },
      },
    },
    {
      $project: {
        product: { $arrayElemAt: ["$product", 0] },
        totalSold: 1,
      },
    },
  ]);

  const products = bestSellingProducts.map(item => ({
    ...item.product,
    totalSold: item.totalSold,
  }));

  // Get total count for pagination
  const totalBestSelling = await Order.distinct("items.product");
  const totalPages = Math.ceil(totalBestSelling.length / limit);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts: totalBestSelling.length,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

// Get featured products (8 products for home page)
const getFeaturedProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({
    is_featured: true,
    stock: { $gt: 0 },
  })
    .populate("owner", "name")
    .sort({ createdAt: -1 })
    .limit(4);

  res.status(200).json({
    success: true,
    data: products,
  });
});


// get top 8 our products

const getOurProducts = asyncHandler(async (req, res, next) => {

  const products = await Product.find({
    stock: { $gt: 0 },
  })
    .populate("owner", "name")
    .sort({ createdAt: -1 })
    .limit(8);

  res.status(200).json({
    success: true,
    data: products,
  });
});

// Get all products with pagination (for view all button)
const getAllProducts = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    category,
    minPrice,
    maxPrice,
    sortBy = "createdAt",
    sortOrder = "desc"
  } = req.query;

  const query = { stock: { $gt: 0 } };

  // Category filter
  if (category) {
    query.category = { $regex: category, $options: "i" };
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  const skip = (page - 1) * limit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const products = await Product.find(query)
    .populate("owner", "name")
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalProducts,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

// Get products by category
const getProductsByCategory = asyncHandler(async (req, res, next) => {
  const { categoryId, page = 1, limit = 20 } = req.query;

  if (!categoryId) {
    return next(new CustomError(400, "Category ID is required"));
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    return next(new CustomError(404, "Category not found"));
  }

  const query = {
    category: { $regex: category.title, $options: "i" },
    stock: { $gt: 0 },
  };

  const skip = (page - 1) * limit;

  const products = await Product.find(query)
    .populate("owner", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);

  res.status(200).json({
    success: true,
    data: {
      category,
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalProducts,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
  });
});

export {
  searchProducts,
  getTopCategories,
  getFlashSaleProducts,
  getAllFlashSaleProducts,
  getBestSellingProducts,
  getAllBestSellingProducts,
  getFeaturedProducts,
  getAllProducts,
  getProductsByCategory,
  getOurProducts
};
