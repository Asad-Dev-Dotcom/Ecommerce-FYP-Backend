import cookieParser from "cookie-parser";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import AuthRoutes from "./routes/auth.routes.js";
import UserRoutes from "./routes/user.routes.js";
import MemberRoutes from "./routes/member.routes.js";
import ClaimsRoutes from "./routes/claims.routes.js";
import ChatRoutes from "./routes/chat.routes.js";
import NotificationRoutes from "./routes/notifications.routes.js";
import InvoicesRoutes from "./routes/invoices.routes.js";
import PaymentRoutes from "./routes/payment.routes.js";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { initSocket, getIo, userSockets } from "./utils/sockets.js";
import { initNotificationWatcher } from "./utils/notificationWatcher.js";
import path from "path";
import { fileURLToPath } from "url";

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
    origin: [
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);



app.use(morgan("dev"));
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/logos", express.static(path.join(__dirname, "public/logos")));

//Exclude Parse Webhook

app.use((req, res, next) =>
{
  if (req.originalUrl === "/api/payments/webhook")
  {
    next();
  } else
  {
    express.json()(req, res, next);
  }
});
app.use((req, res, next) =>
{
  if (req.originalUrl === "/api/payments/webhook")
  {
    next();
  } else
  {
    express.urlencoded({ extended: true })(req, res, next);
  }
});

// attach io to req for controllers
//================================
app.use((req, res, next) =>
{
  req.io = io;
  next();
});

// routes
//========
app.get("/", (req, res) =>
  res.status(200).json({ success: true, message: "Hello World!" })
);
app.use("/api/auth", AuthRoutes);
app.use("/api/users", UserRoutes);
app.use("/api/claims", ClaimsRoutes);
app.use("/api/chats", ChatRoutes);
app.use("/api/notifications", NotificationRoutes);
app.use("/api/members", MemberRoutes);
app.use("/api/invoices", InvoicesRoutes);
app.use("/api/payments", PaymentRoutes);

console.log("sockets ids", userSockets);
// error handler
//=============
app.use(errorHandler);

console.log("hello warranty system + charity project");

export { app, server, io };
