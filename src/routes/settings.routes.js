import express from "express";
import {
    getSettings,
    updateSettings,
    getPublicConfig,
} from "../controllers/settings.controller.js";
import { isAdmin, isAuthenticated } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public route
router.get("/config", getPublicConfig);

// Admin routes
router.get("/admin", isAuthenticated, isAdmin, getSettings);
router.put("/admin", isAuthenticated, isAdmin, updateSettings);

export default router;
