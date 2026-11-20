import "dotenv/config";
import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { apiLimiter } from "./middleware/rateLimiter.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import busRoutes from "./routes/busRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import governmentBusRoutes from "./routes/governmentBusRoutes.js";
import trainRoutes from "./routes/trainRoutes.js";
import hotelRoutes from "./routes/hotelRoutes.js";
import operatorRoutes from "./routes/operatorRoutes.js";
import promotionRoutes from "./routes/promotionRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

// Parse and normalize CORS allowlist from environment variables
const rawClientUrls =
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  "http://localhost:5173,http://localhost:5174";

const allowedOrigins = rawClientUrls
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests, mobile clients, curl, Postman (requests without an Origin header)
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Not allowed by CORS: Origin ${origin} is not in the allowlist.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Idempotency-Key",
    "x-idempotency-key",
    "idempotency-key",
    "x-session-id",
    "x-razorpay-signature",
  ],
  optionsSuccessStatus: 204,
};

// 1. CORS Middleware - Registered FIRST before all routes, rate limiters, and auth middleware
// In Express 5, cors() middleware intercepts and responds to all OPTIONS preflight requests automatically.
app.use(cors(corsOptions));

// 2. Security Headers (configured to allow cross-origin resource sharing)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());

// 3. Rate limiting for general API requests (runs AFTER CORS preflight is handled)
app.use("/api", apiLimiter);

// 4. Body and Cookie Parsers
app.use(cookieParser());
app.use(express.json({
  verify: (req, res, buffer) => {
    const path = req.originalUrl.split("?")[0];
    if (path === "/api/payment/webhook" || path === "/api/payment/webhook-train") {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));

// 5. Application Routes
app.use("/api", locationRoutes);
app.use("/", healthRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/government-buses", governmentBusRoutes);
app.use("/api/trains", trainRoutes);
app.use("/api/hotels", hotelRoutes);
app.use("/api/operators", operatorRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payment", paymentRoutes);

// 6. Protected Admin Panel Routes (RBAC enforced)
app.use("/api/admin", adminRoutes);

// 7. 404 Handler for unknown routes
app.use(notFoundHandler);

// 8. Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
