import express from "express";
import {
  createProduct,
  getAllProducts,
  getOneProduct,
  getMyProducts,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { multipleUpload } from "../middlewares/multer.js";

const router = express.Router();

// Public routes
router.get("/", getAllProducts);
router.get("/category/:categoryName", getProductsByCategory);
router.get("/:id", getOneProduct);

// Protected routes (require authentication)
router.use(isAuthenticated);

router.get("/my-products", getMyProducts);
router.post("/", multipleUpload, createProduct);
router.put("/:id", multipleUpload, updateProduct);
router.delete("/:id", deleteProduct);

export default router;
