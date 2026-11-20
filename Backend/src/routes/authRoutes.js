import express from "express";
import {
  sendOtpController,
  resendOtpController,
  verifyOtpController,
} from "../controllers/otpController.js";
import {
  forgotPasswordController,
  resetPasswordController,
  login,
  googleLogin,
  getMe,
  logout,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { otpSendLimiter, otpVerifyLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// 1. Send OTP (Rate-limited: 6 send requests per 15 min per IP)
router.post("/send-otp", otpSendLimiter, sendOtpController);
router.post("/resend-otp", otpSendLimiter, resendOtpController);

// 2. Verify OTP & Login/Register (Rate-limited: 10 verify requests per 15 min per IP)
router.post("/verify-otp", otpVerifyLimiter, verifyOtpController);
router.post("/register", otpVerifyLimiter, verifyOtpController);

// 3. Password Reset Flow (Email OTP)
router.post("/forgot-password", otpSendLimiter, forgotPasswordController);
router.post("/reset-password", otpVerifyLimiter, resetPasswordController);

// 4. Password Login
router.post("/login", login);

// 5. Google OAuth Login
router.post("/google", googleLogin);

// 6. Current Authenticated User & Session
router.get("/me", authenticate, getMe);
router.post("/logout", logout);

export default router;
