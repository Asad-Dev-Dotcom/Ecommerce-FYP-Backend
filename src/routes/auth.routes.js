import express from "express";
import
  {
    forgetPassword,
    getMyProfile,
    login,
    logout,
    register,
    resetPassword,
    updateMyProfile,
    signup
  } from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { singleUpload } from "../middlewares/multer.js";

const app = express.Router();

app.post("/register", singleUpload, register);
app.post("/signup", singleUpload, signup);
app.post("/login", login);
app.get("/logout", isAuthenticated, logout);
app.post("/forget-password", forgetPassword);
app.post("/reset-password", resetPassword);
app.route("/my-profile").get(isAuthenticated, getMyProfile).put(isAuthenticated, singleUpload, updateMyProfile);

export default app;
