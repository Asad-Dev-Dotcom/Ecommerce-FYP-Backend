import { isValidObjectId } from "mongoose";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { createCheckoutSession } from "../utils/stripe.js";
import { getEnv } from "../configs/config.js";
import { PaymentIntent } from "../models/paymentIntent.model.js";

// Create new order (client side)
const createOrder = asyncHandler(async (req, res, next) => {
  const customerId = req?.user?._id;
  if (!customerId) {
    return next(new CustomError(401, "Unauthorized"));
  }

  const {
    items,
    shippingAddress,
    paymentMethod,
  } = req.body;

  console.log("req.body", req.body);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new CustomError(400, "Please provide order items"));
  }

  if (!shippingAddress) {
    return next(new CustomError(400, "Please provide shipping address"));
  }

  // Validate and fetch product details
  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    if (!item.id || !item.quantity || item.quantity < 1) {
      return next(new CustomError(400, "Invalid item data"));
    }

    const product = await Product.findById(item.id);
    if (!product) {
      return next(new CustomError(404, `Product ${item.id} not found`));
    }

    if (product.stock < item.quantity) {
      return next(new CustomError(400, `Insufficient stock for ${product.name}`));
    }

    const itemTotal = product.price * item.quantity;
    totalAmount += itemTotal;

    orderItems.push({
      product: product._id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      image: product.images[0]?.url || "",
    });

    // Update product stock
    product.stock -= item.quantity;
    await product.save();
  }

  // Create the order
  const newOrder = await Order.create({
    customer: customerId,
    items: orderItems,
    totalAmount,
    shippingAddress,
    paymentMethod: paymentMethod === "online" ? "online" : "cash_on_delivery",
  });

  // Populate customer and product details
  await newOrder.populate("customer", "name email");

  if (paymentMethod === "online") {
    const metaData = {
      orderId: newOrder._id.toString(),
      customerId: customerId.toString(),
      totalAmount: totalAmount.toString(),
      shippingAddress: JSON.stringify(shippingAddress),
      paymentMethod: paymentMethod.toString(),
    }
    const response = await createCheckoutSession(orderItems, `${getEnv("FRONTEND_URL")}/orders`, `${getEnv("FRONTEND_URL")}/orders`, metaData);
    if (!response.success) {
      return next(new CustomError(500, response.error));
    }
    const paymentIntent = await PaymentIntent.create({
      order: newOrder._id,
      intentId: response.sessionId,
      totalAmount,
    });
    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: newOrder,
      paymentIntent,
      sessionUrl: response.sessionUrl,
    });
  } else {
    const paymentIntent = await PaymentIntent.create({
      order: newOrder._id,
      intentId: "cash_on_delivery",
      totalAmount,
    });
    await newOrder.save();
    await newOrder.populate("customer", "name email");
    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: newOrder, paymentIntent,
    });
  }
});

// Get user's own orders (client side)
const getMyOrders = asyncHandler(async (req, res, next) => {
  const customerId = req?.user?._id;
  if (!customerId) {
    return next(new CustomError(401, "Unauthorized"));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const orders = await Order.find({ customer: customerId })
    .populate("customer", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments({ customer: customerId });
  const totalPages = Math.ceil(totalOrders / limit);

  res.status(200).json({
    success: true,
    data: orders,
    pagination: {
      currentPage: page,
      totalPages,
      totalOrders,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

// Get all orders (admin side)
const getAllOrders = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const status = req.query.status;
  const query = status ? { status } : {};

  const orders = await Order.find(query)
    .populate("customer", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  res.status(200).json({
    success: true,
    data: orders,
    pagination: {
      currentPage: page,
      totalPages,
      totalOrders,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

// Get one order (client can get their own, admin can get any)
const getOneOrder = asyncHandler(async (req, res, next) => {
  const orderId = req.params.id;
  const userId = req?.user?._id;
  const userRole = req?.user?.role;

  if (!isValidObjectId(orderId)) {
    return next(new CustomError(400, "Invalid order ID"));
  }

  const order = await Order.findById(orderId).populate("customer", "name email");
  if (!order) {
    return next(new CustomError(404, "Order not found"));
  }

  // Check if user can access this order
  if (userRole !== "admin" && order.customer._id.toString() !== userId.toString()) {
    return next(new CustomError(403, "Access denied"));
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

// Update order status (admin only)
const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const orderId = req.params.id;
  const { status, trackingNumber } = req.body;

  if (!isValidObjectId(orderId)) {
    return next(new CustomError(400, "Invalid order ID"));
  }

  const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    return next(new CustomError(400, "Invalid status"));
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new CustomError(404, "Order not found"));
  }

  // Update status and tracking number if provided
  order.status = status;
  if (trackingNumber) {
    order.trackingNumber = trackingNumber;
  }

  // Set cancelledBy if admin is cancelling the order
  if (status === "cancelled") {
    order.cancelledBy = "admin";
  }

  await order.save();
  await order.populate("customer", "name email");

  res.status(200).json({
    success: true,
    message: "Order status updated successfully",
    data: order,
  });
});

// Cancel order (client can cancel their own pending orders)
const cancelOrder = asyncHandler(async (req, res, next) => {
  const orderId = req.params.id;
  const userId = req?.user?._id;

  if (!isValidObjectId(orderId)) {
    return next(new CustomError(400, "Invalid order ID"));
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return next(new CustomError(404, "Order not found"));
  }

  // Check if user owns this order
  if (order.customer.toString() !== userId.toString()) {
    return next(new CustomError(403, "Access denied"));
  }

  // Only allow cancellation of pending orders
  if (order.status !== "pending") {
    return next(new CustomError(400, "Can only cancel pending orders"));
  }

  // Restore product stock
  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock += item.quantity;
      await product.save();
    }
  }

  order.status = "cancelled";
  order.cancelledBy = "client";
  await order.save();
  await order.populate("customer", "name email");

  res.status(200).json({
    success: true,
    message: "Order cancelled successfully",
    data: order,
  });
});

export {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOneOrder,
  updateOrderStatus,
  cancelOrder,
};
