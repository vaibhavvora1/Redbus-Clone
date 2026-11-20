import express from "express";
import {
  createOrder,
  verifyPayment,
  razorpayWebhook,
  razorpayTrainWebhook,
} from "../controllers/paymentController.js";
import { optionalAuthenticate } from "../middleware/authMiddleware.js";
import { bookingLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/create-order", bookingLimiter, optionalAuthenticate, createOrder);
router.post("/verify", bookingLimiter, optionalAuthenticate, verifyPayment);
router.post("/webhook", razorpayWebhook);
router.post("/webhook-train", razorpayTrainWebhook);

export default router;

