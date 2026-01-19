import { PaymentIntent } from "../models/paymentIntent.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { isValidObjectId } from "mongoose";

// Get all payments with filters, search, and pagination (Admin only)
const getAllPayments = asyncHandler(async (req, res, next) => {
    const {
        page = 1,
        limit = 10,
        search = "",
        status = "",
        startDate = "",
        endDate = "",
        sortBy = "createdAt",
        sortOrder = "desc"
    } = req.query;

    // Build query
    const query = {};

    // Status filter
    if (status && status !== "all") {
        query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
            query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            // Set to end of day
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get payments with populated order and customer data
    let payments = await PaymentIntent.find(query)
        .populate({
            path: "order",
            populate: {
                path: "customer",
                select: "name email phone"
            }
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

    // Apply search filter after population (searching in customer name/email or intentId)
    if (search) {
        payments = payments.filter(payment => {
            const searchLower = search.toLowerCase();
            const customerName = payment.order?.customer?.name?.toLowerCase() || "";
            const customerEmail = payment.order?.customer?.email?.toLowerCase() || "";
            const intentId = payment.intentId?.toLowerCase() || "";
            const orderId = payment.order?._id?.toString() || "";

            return (
                customerName.includes(searchLower) ||
                customerEmail.includes(searchLower) ||
                intentId.includes(searchLower) ||
                orderId.includes(searchLower)
            );
        });
    }

    // Get total count for pagination
    const totalPayments = await PaymentIntent.countDocuments(query);
    const totalPages = Math.ceil(totalPayments / parseInt(limit));

    res.status(200).json({
        success: true,
        data: payments,
        pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalPayments,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1,
        },
    });
});

// Get payment analytics (Admin only)
const getPaymentAnalytics = asyncHandler(async (req, res, next) => {
    const { period = "monthly" } = req.query;

    // Calculate total revenue
    const totalRevenueResult = await PaymentIntent.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    // Count by status
    const statusCounts = await PaymentIntent.aggregate([
        {
            $group: {
                _id: "$status",
                count: { $count: {} },
                amount: { $sum: "$totalAmount" }
            }
        }
    ]);

    const analytics = {
        totalRevenue,
        pendingPayments: statusCounts.find(s => s._id === "pending")?.count || 0,
        pendingAmount: statusCounts.find(s => s._id === "pending")?.amount || 0,
        completedPayments: statusCounts.find(s => s._id === "paid")?.count || 0,
        completedAmount: statusCounts.find(s => s._id === "paid")?.amount || 0,
        failedPayments: statusCounts.find(s => s._id === "failed")?.count || 0,
        failedAmount: statusCounts.find(s => s._id === "failed")?.amount || 0,
        refundedPayments: statusCounts.find(s => s._id === "refunded")?.count || 0,
        refundedAmount: statusCounts.find(s => s._id === "refunded")?.amount || 0,
    };

    // Revenue trend data based on period
    let groupByFormat;
    let dateRange;

    if (period === "daily") {
        // Last 7 days
        groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        dateRange = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "weekly") {
        // Last 12 weeks
        groupByFormat = { $dateToString: { format: "%Y-W%V", date: "$createdAt" } };
        dateRange = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);
    } else {
        // Last 12 months (default: monthly)
        groupByFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        dateRange = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
    }

    const revenueTrend = await PaymentIntent.aggregate([
        {
            $match: {
                status: "paid",
                createdAt: { $gte: dateRange }
            }
        },
        {
            $group: {
                _id: groupByFormat,
                revenue: { $sum: "$totalAmount" },
                count: { $count: {} }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    analytics.revenueTrend = revenueTrend.map(item => ({
        period: item._id,
        revenue: item.revenue,
        count: item.count
    }));

    res.status(200).json({
        success: true,
        data: analytics,
    });
});

// Update payment status (Admin only)
const updatePaymentStatus = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
        return next(new CustomError(400, "Invalid payment ID"));
    }

    const validStatuses = ["pending", "paid", "failed", "refunded"];
    if (!status || !validStatuses.includes(status)) {
        return next(new CustomError(400, "Invalid status"));
    }

    const payment = await PaymentIntent.findById(id);
    if (!payment) {
        return next(new CustomError(404, "Payment not found"));
    }

    payment.status = status;
    await payment.save();

    // Populate for response
    await payment.populate({
        path: "order",
        populate: {
            path: "customer",
            select: "name email phone"
        }
    });

    res.status(200).json({
        success: true,
        message: "Payment status updated successfully",
        data: payment,
    });
});

export {
    getAllPayments,
    getPaymentAnalytics,
    updatePaymentStatus,
};
