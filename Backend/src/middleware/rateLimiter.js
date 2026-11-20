import rateLimit from "express-rate-limit";

const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || "15", 10);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || "200", 10);
const bookingMax = parseInt(process.env.BOOKING_RATE_LIMIT_MAX || "30", 10);

/**
 * General API Rate Limiter
 */
export const apiLimiter = rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max: maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
});

/**
 * OTP Send Rate Limiter (6 requests per 15 minutes per IP)
 * Separate from verify so legitimate verify attempts don't eat into the send budget.
 */
export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.OTP_SEND_RATE_LIMIT_MAX || "6", 10),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    message: "Too many OTP send requests from this IP. Please wait 15 minutes before trying again.",
  },
});

/**
 * OTP Verify Rate Limiter (10 requests per 15 minutes per IP)
 * More generous than send — a user may legitimately mistype a few times.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.OTP_VERIFY_RATE_LIMIT_MAX || "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    message: "Too many verification attempts from this IP. Please wait 15 minutes.",
  },
});

/**
 * Backward-compatible alias (used by existing route files)
 */
export const otpLimiter = otpSendLimiter;

export const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: bookingMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    message: "Too many booking requests. Please wait before trying again.",
  },
});

export default { apiLimiter, otpLimiter, otpSendLimiter, otpVerifyLimiter, bookingLimiter };
