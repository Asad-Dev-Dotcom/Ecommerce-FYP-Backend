import express from "express";
import { isAdmin, isAuthenticated } from "../middlewares/authMiddleware.js";
import {
    getAllPayments,
    getPaymentAnalytics,
    updatePaymentStatus,
} from "../controllers/payment.controller.js";

const app = express.Router();

// Admin routes
app.get("/", isAuthenticated, isAdmin, getAllPayments);
app.get("/analytics", isAuthenticated, isAdmin, getPaymentAnalytics);
app.put("/:id/status", isAuthenticated, isAdmin, updatePaymentStatus);

export default app;
