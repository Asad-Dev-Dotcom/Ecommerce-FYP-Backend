import cookieParser from "cookie-parser";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import AuthRoutes from "./routes/auth.routes.js";
import ProductRoutes from "./routes/product.routes.js";
import CategoryRoutes from "./routes/category.routes.js";
import OrderRoutes from "./routes/order.routes.js";
import DashboardRoutes from "./routes/dashboard.routes.js";
import HomeRoutes from "./routes/home.routes.js";
import StripeWebhookRoutes from "./routes/stripe-webhook.routes.js";
import WishlistRoutes from "./routes/wishlist.routes.js";
import SettingsRoutes from "./routes/settings.routes.js";
import PaymentRoutes from "./routes/payment.routes.js";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { initSocket, getIo, userSockets } from "./utils/sockets.js";
import { initNotificationWatcher } from "./utils/notificationWatcher.js";
import path from "path";
import { fileURLToPath } from "url";
import { getEnv } from "./configs/config.js";

const app = express();

// Socket setup
//=============
const server = http.createServer(app);
const io = initSocket(server);

// middlewares
//===============
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:5173", getEnv("FRONTEND_URL")],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);

app.use(morgan("dev"));
app.use(cookieParser());

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// app.use("/logos", express.static(path.join(__dirname, "public/logos")));

//Exclude Parse Webhook
// Stripe webhook MUST be raw
app.use(
  "/api/stripeWebhook",
  express.raw({ type: "application/json" })
);

// Normal body parsing for rest
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// attach io to req for controllers
//================================
app.use((req, res, next) => {
  req.io = io;
  next();
});

// routes
//========
app.get("/", (req, res) =>
  res.status(200).json({ success: true, message: "Hello World!" })
);
app.use("/api/auth", AuthRoutes);
app.use("/api/products", ProductRoutes);
app.use("/api/categories", CategoryRoutes);
app.use("/api/orders", OrderRoutes);
app.use("/api/dashboard", DashboardRoutes);
app.use("/api/home", HomeRoutes);
app.use("/api/wishlist", WishlistRoutes);
app.use("/api/settings", SettingsRoutes);
app.use("/api/payments", PaymentRoutes);
app.use("/api/stripeWebhook", StripeWebhookRoutes);
console.log("sockets ids", userSockets);
// error handler
//=============
app.use(errorHandler);

console.log("hello warranty system + charity project");

export { app, server, io };
