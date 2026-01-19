import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { Auth } from "../models/auth.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";

// Get comprehensive dashboard stats
const getDashboardStats = asyncHandler(async (req, res, next) => {
  // Get total revenue and orders
  const revenueStats = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: "$totalAmount" },
      },
    },
  ]);

  // Get total sales (products sold)
  const salesStats = await Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$items.quantity" },
      },
    },
  ]);

  // Get order status breakdown
  const orderStatusStats = await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Get low stock alerts (products with stock <= 5)
  const lowStockProducts = await Product.find({ stock: { $lte: 5 } })
    .select("name stock images")
    .sort({ stock: 1 })
    .limit(10);

  // Get recent orders
  const recentOrders = await Order.find()
    .populate("customer", "name email")
    .sort({ createdAt: -1 })
    .limit(5);

  // Get total customers
  const totalCustomers = await Auth.countDocuments({ role: "member" });

  // Get total products
  const totalProducts = await Product.countDocuments();

  // Get monthly revenue for the last 12 months
  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last 12 months
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": -1, "_id.month": -1 },
    },
    { $limit: 12 },
  ]);

  // Get top selling products
  const topProducts = await Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        totalSold: { $sum: "$items.quantity" },
        totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
      },
    },
    {
      $sort: { totalSold: -1 },
    },
    { $limit: 5 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $project: {
        name: 1,
        totalSold: 1,
        totalRevenue: 1,
        image: { $arrayElemAt: ["$product.images.url", 0] },
      },
    },
  ]);

  const stats = {
    totalRevenue: revenueStats[0]?.totalRevenue || 0,
    totalOrders: revenueStats[0]?.totalOrders || 0,
    totalSales: salesStats[0]?.totalSales || 0,
    averageOrderValue: revenueStats[0]?.averageOrderValue || 0,
    totalCustomers,
    totalProducts,
    orderStatusBreakdown: orderStatusStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {}),
    lowStockAlerts: lowStockProducts.map(product => ({
      id: product._id,
      name: product.name,
      stock: product.stock,
      image: product.images[0]?.url,
    })),
    recentOrders: recentOrders.map(order => ({
      id: order._id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
    })),
    monthlyRevenue,
    topProducts,
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
});

// Get sales analytics with date range filtering
const getSalesAnalytics = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, period = "monthly" } = req.query;

  let matchCondition = {};

  if (startDate && endDate) {
    matchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  let groupBy;
  switch (period) {
    case "daily":
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
      break;
    case "weekly":
      groupBy = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" },
      };
      break;
    case "monthly":
    default:
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
      break;
  }

  const salesData = await Order.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: groupBy,
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
        averageOrderValue: { $avg: "$totalAmount" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } },
  ]);

  res.status(200).json({
    success: true,
    data: salesData,
    period,
  });
});

// Get product performance metrics
const getProductAnalytics = asyncHandler(async (req, res, next) => {
  const { limit = 20 } = req.query;

  const productStats = await Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        totalSold: { $sum: "$items.quantity" },
        totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        orderCount: { $addToSet: "$_id" },
      },
    },
    {
      $addFields: {
        orderCount: { $size: "$orderCount" },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $project: {
        name: 1,
        totalSold: 1,
        totalRevenue: 1,
        orderCount: 1,
        currentStock: { $arrayElemAt: ["$product.stock", 0] },
        category: { $arrayElemAt: ["$product.category", 0] },
        image: { $arrayElemAt: ["$product.images.url", 0] },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: parseInt(limit) },
  ]);

  res.status(200).json({
    success: true,
    data: productStats,
  });
});

// Get customer analytics
const getCustomerAnalytics = asyncHandler(async (req, res, next) => {
  // Top customers by order value
  const topCustomers = await Order.aggregate([
    {
      $group: {
        _id: "$customer",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" },
        averageOrderValue: { $avg: "$totalAmount" },
        lastOrderDate: { $max: "$createdAt" },
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "auths",
        localField: "_id",
        foreignField: "_id",
        as: "customer",
      },
    },
    {
      $project: {
        customer: { $arrayElemAt: ["$customer", 0] },
        totalOrders: 1,
        totalSpent: 1,
        averageOrderValue: 1,
        lastOrderDate: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: {
      topCustomers: topCustomers.map(item => ({
        id: item.customer._id,
        name: item.customer.name,
        email: item.customer.email,
        totalOrders: item.totalOrders,
        totalSpent: item.totalSpent,
        averageOrderValue: item.averageOrderValue,
        lastOrderDate: item.lastOrderDate,
      })),
    },
  });
});

// Get all users with stats
const getAllUsers = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, search = "" } = req.query;

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const searchRegex = new RegExp(search, "i");

  const matchCondition = {
    $or: [{ name: searchRegex }, { email: searchRegex }],
    role: "client", // Only list clients, not admins
  };

  // Get users
  const users = await Auth.find(matchCondition)
    .select("name email phone image createdAt")
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // Get total count for pagination
  const totalUsers = await Auth.countDocuments(matchCondition);

  // Calculate stats for each user
  const usersWithStats = await Promise.all(
    users.map(async (user) => {
      const stats = await Order.aggregate([
        { $match: { customer: user._id } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: "$totalAmount" },
          },
        },
      ]);

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "N/A",
        image: user.image?.url,
        createdAt: user.createdAt,
        totalOrders: stats[0]?.totalOrders || 0,
        totalSpent: stats[0]?.totalSpent || 0,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      users: usersWithStats,
      totalUsers: totalUsers,

      pagination: {
        total: totalUsers,
        page: pageNumber,
        pages: Math.ceil(totalUsers / limitNumber),
      },
    },
  });
});

export {
  getDashboardStats,
  getSalesAnalytics,
  getProductAnalytics,
  getCustomerAnalytics,
  getAllUsers,
};
