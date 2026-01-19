import express from "express";
import {
  getDashboardStats,
  getSalesAnalytics,
  getProductAnalytics,
  getCustomerAnalytics,
  getAllUsers,
} from "../controllers/dashboard.controller.js";
import { isAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All dashboard routes require admin authentication
router.use(isAdmin);

router.get("/stats", getDashboardStats);
router.get("/sales", getSalesAnalytics);
router.get("/products", getProductAnalytics);
router.get("/customers", getCustomerAnalytics);
router.get("/users", getAllUsers);

export default router;
