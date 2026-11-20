import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import OtpSendWindow from "../models/OtpSendWindow.js";
import { sendOtp } from "../utils/sendOtp.js";
import { isValidIndianPhone, normalizePhone } from "../utils/userFields.js";
import { getDuplicateUserConflict, sendUserError } from "../utils/userErrors.js";
import {
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from "../utils/authSchemas.js";

// ── Constants ───────────────────────────────────────────────────────

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || "30", 10);
const OTP_MAX_SENDS_PER_HOUR = parseInt(process.env.OTP_MAX_SENDS_PER_HOUR || "8", 10);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const IS_DEV = process.env.NODE_ENV === "development";

// ── Helpers ─────────────────────────────────────────────────────────

const sendFirstValidationError = (res, error, fallbackMessage) =>
  res.status(400).json({
    success: false,
    message: error.issues[0]?.message || fallbackMessage,
  });

const emailAlreadyRegistered = (res) =>
  res.status(409).json({
    success: false,
    message: "Email already registered. Please login.",
  });

const phoneAlreadyRegistered = (res) =>
  res.status(409).json({
    success: false,
    message: "Phone number already registered. Please login.",
  });

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ── consumeOtp (fixed: no TOCTOU race) ─────────────────────────────

/**
 * Atomically verify and consume an OTP.
 *
 * Flow:
 *  1. Find the latest OTP for email+purpose (don't modify yet).
 *  2. Check expiry and attempts limit.
 *  3. bcrypt.compare the input.
 *  4. Wrong → atomically increment attempts; if at max → delete.
 *  5. Correct → deleteOne to consume it.
 */
export async function consumeOtp(email, otp, purpose = "register") {
  const now = new Date();
  const maxAttempts = OTP_MAX_ATTEMPTS;

  // 1. Find the latest non-expired OTP for this email+purpose
  const otpDoc = await Otp.findOne({
    email,
    purpose,
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    // Check if there's an expired or max-attempt doc to give a better message
    const staleDoc = await Otp.findOne({ email, purpose }).sort({ createdAt: -1 }).lean();
    if (staleDoc && staleDoc.attempts >= maxAttempts) {
      await Otp.deleteMany({ email, purpose });
      return {
        status: 429,
        message: "Maximum verification attempts exceeded. Please request a new OTP.",
      };
    }
    // Clean up expired
    await Otp.deleteMany({ email, purpose, expiresAt: { $lte: now } });
    return {
      status: 400,
      message: "OTP has expired or is invalid. Please request a new OTP.",
    };
  }

  // 2. Check attempts limit BEFORE comparing
  if (otpDoc.attempts >= maxAttempts) {
    await Otp.deleteOne({ _id: otpDoc._id });
    return {
      status: 429,
      message: "Maximum verification attempts exceeded. Please request a new OTP.",
    };
  }

  // 3. Compare OTP (both as trimmed strings)
  const isMatch = await bcrypt.compare(String(otp).trim(), otpDoc.otpHash);

  if (!isMatch) {
    // 4. Wrong OTP → increment attempts atomically
    const updated = await Otp.findOneAndUpdate(
      {
        _id: otpDoc._id,
        attempts: { $lt: maxAttempts },
        expiresAt: { $gt: now },
      },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" }
    );

    if (!updated) {
      const current = await Otp.findById(otpDoc._id).select("attempts").lean();
      if (current && current.attempts >= maxAttempts) {
        await Otp.deleteOne({ _id: otpDoc._id, attempts: { $gte: maxAttempts } });
        return {
          status: 429,
          message: "Maximum verification attempts exceeded. Please request a new OTP.",
        };
      }
      return {
        status: 400,
        message: "OTP has expired or has already been used. Please request a new OTP.",
      };
    }

    if (updated && updated.attempts >= maxAttempts) {
      await Otp.deleteOne({ _id: otpDoc._id, attempts: { $gte: maxAttempts } });
      return {
        status: 429,
        message: "Maximum verification attempts exceeded. Please request a new OTP.",
      };
    }

    const remaining = maxAttempts - (updated?.attempts || otpDoc.attempts + 1);
    return {
      status: 400,
      message: `Invalid OTP code. ${remaining} attempt(s) remaining.`,
    };
  }

  // Only one concurrent request can consume this exact OTP.
  const consumedOtp = await Otp.findOneAndDelete({
    _id: otpDoc._id,
    otpHash: otpDoc.otpHash,
    attempts: { $lt: maxAttempts },
    expiresAt: { $gt: now },
  });
  if (!consumedOtp) {
    return {
      status: 400,
      message: "OTP has expired or has already been used. Please request a new OTP.",
    };
  }
  return { ok: true };
}

async function consumeOtpSendQuota(email, purpose, now) {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const windowExpiry = new Date(now.getTime() + 60 * 60 * 1000);
  const filter = { email, purpose };
  const updatePipeline = [
    {
      $set: {
        email: { $literal: email },
        purpose: { $literal: purpose },
        windowStartedAt: {
          $cond: [
            { $gt: ["$windowStartedAt", oneHourAgo] },
            "$windowStartedAt",
            now,
          ],
        },
        sendCount: {
          $cond: [
            { $gt: ["$windowStartedAt", oneHourAgo] },
            { $add: [{ $ifNull: ["$sendCount", 0] }, 1] },
            1,
          ],
        },
        expiresAt: {
          $cond: [
            { $gt: ["$windowStartedAt", oneHourAgo] },
            "$expiresAt",
            windowExpiry,
          ],
        },
      },
    },
  ];

  let window;
  for (let attempt = 0; attempt < 2 && !window; attempt += 1) {
    try {
      window = await OtpSendWindow.findOneAndUpdate(filter, updatePipeline, {
        upsert: attempt === 0,
        returnDocument: "after",
        updatePipeline: true,
      });
    } catch (error) {
      if (error.code !== 11000 || attempt !== 0) throw error;
    }
  }
  if (!window) throw new Error("Could not update OTP send limit.");

  const allowed = window.sendCount <= OTP_MAX_SENDS_PER_HOUR;
  const windowEnd = new Date(window.windowStartedAt).getTime() + 60 * 60 * 1000;
  const remainingSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000));

  return { allowed, remainingSeconds };
}

// ── 1. SEND OTP ─────────────────────────────────────────────────────
// POST /api/auth/send-otp

export const sendOtpController = async (req, res) => {
  try {
    const parseResult = sendOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendFirstValidationError(
        res,
        parseResult.error,
        "Please provide a valid email address."
      );
    }

    const { email, phone, purpose } = parseResult.data;
    const otpPurpose = purpose || "register";

    // For registration, block if email already exists
    if (otpPurpose === "register") {
      const existingUser = await User.findOne({ email }).select("_id").lean();
      if (existingUser) return emailAlreadyRegistered(res);

      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone) {
        const existingByPhone = await User.findOne({
          $or: [{ phone: normalizedPhone }, { mobile: normalizedPhone }],
        }).select("_id").lean();
        if (existingByPhone) return phoneAlreadyRegistered(res);
      }
    }
    if (otpPurpose === "forgot-password") {
      const existingUser = await User.findOne({ email }).select("_id").lean();
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email address.",
        });
      }
    }

    const now = new Date();

    // ── Resend cooldown (30 seconds) ──
    const existingOtp = await Otp.findOne({ email, purpose: otpPurpose })
      .sort({ createdAt: -1 })
      .lean();

    if (existingOtp && existingOtp.lastSentAt) {
      const elapsedSeconds =
        (now.getTime() - new Date(existingOtp.lastSentAt).getTime()) / 1000;
      if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} seconds before requesting a new OTP.`,
          cooldownRemaining: remaining,
        });
      }
    }

    // ── Max sends per hour ──
    const sendQuota = await consumeOtpSendQuota(email, otpPurpose, now);
    if (!sendQuota.allowed) {
      return res.status(429).json({
        success: false,
        message: `Hourly OTP request limit reached. Try again in ${sendQuota.remainingSeconds} seconds.`,
        cooldownRemaining: sendQuota.remainingSeconds,
      });
    }

    // ── Generate 6-digit OTP with crypto.randomInt (not Math.random) ──
    const otp = crypto.randomInt(100000, 1000000).toString();

    // ── Hash OTP with bcrypt ──
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // ── Invalidate all previous OTPs for this email+purpose, then create a fresh one ──
    await Otp.deleteMany({ email, purpose: otpPurpose });

    const savedOtp = await Otp.create({
      email,
      purpose: otpPurpose,
      otpHash,
      attempts: 0,
      expiresAt,
      lastSentAt: now,
    });

    // ── Send the email via Nodemailer ──
    try {
      await sendOtp(email, otp);
    } catch (sendError) {
      // If sending fails, don't leave an OTP the user never received.
      await Otp.deleteOne({ _id: savedOtp._id });
      return res.status(500).json({
        success: false,
        message:
          process.env.NODE_ENV === "production"
            ? "Failed to deliver OTP email. Please try again."
            : sendError.message || "Failed to deliver OTP email. Please try again.",
      });
    }

    // ── Response: never include the OTP outside development ──
    const response = {
      success: true,
      message: `OTP sent successfully to ${email}.`,
      expiresIn: OTP_EXPIRY_MINUTES * 60,
      cooldown: OTP_RESEND_COOLDOWN_SECONDS,
    };

    // Dev only: include OTP in response for Postman testing
    if (IS_DEV) {
      response.__dev_otp = otp;
    }

    return res.status(200).json(response);
  } catch (error) {
    return sendUserError(res, error, "Server error while sending OTP.");
  }
};

// ── 2. RESEND OTP ───────────────────────────────────────────────────
// POST /api/auth/resend-otp

export const resendOtpController = async (req, res) => {
  return sendOtpController(req, res);
};

// ── 3. VERIFY OTP & COMPLETE REGISTRATION / LOGIN ───────────────────
// POST /api/auth/verify-otp

export const verifyOtpController = async (req, res) => {
  const isRegisterRoute = req.path.endsWith("/register");
  const isRegistrationRequest = req.body?.purpose === "register" || isRegisterRoute;

  try {
    const parseResult = verifyOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendFirstValidationError(
        res,
        parseResult.error,
        "Invalid email or OTP format."
      );
    }

    const {
      email,
      otp,
      name,
      password,
      phone: validatedPhone,   // already normalized by Zod transform
      mobile: validatedMobile, // already normalized by Zod transform
      purpose,
    } = parseResult.data;

    const otpPurpose = isRegisterRoute ? "register" : purpose || "login";

    // ── Registration-specific validation ──
    if (isRegistrationRequest) {
      const registration = registerSchema.safeParse({
        name,
        email,
        password,
        phone: validatedPhone || validatedMobile,
      });
      if (!registration.success) {
        return sendFirstValidationError(
          res,
          registration.error,
          "Please provide valid registration details."
        );
      }

      // Check email duplicate
      const existingByEmail = await User.findOne({ email }).select("_id").lean();
      if (existingByEmail) return emailAlreadyRegistered(res);

      // Check phone duplicate (if phone provided)
      const phone = validatedPhone || validatedMobile;
      if (phone) {
        const normalizedPhone = normalizePhone(phone);
        if (normalizedPhone) {
          const existingByPhone = await User.findOne({
            $or: [
              { phone: normalizedPhone },
              { mobile: normalizedPhone },
            ],
          }).select("_id").lean();
          if (existingByPhone) return phoneAlreadyRegistered(res);
        }
      }
    }

    // ── Consume OTP (the fixed, race-free version) ──
    const otpResult = await consumeOtp(email, otp, otpPurpose);
    if (!otpResult.ok) {
      return res
        .status(otpResult.status)
        .json({ success: false, message: otpResult.message });
    }

    // ── Create or find user ──
    let user;
    const phone = normalizePhone(validatedPhone) || normalizePhone(validatedMobile);

    try {
      if (isRegistrationRequest) {
        user = await User.create({
          name,
          email,
          password,
          ...(phone ? { phone, mobile: phone } : {}),
          role: "USER",
          isEmailVerified: true,
          isVerified: true,
        });
      } else {
        // Login via OTP: find-or-create
        const defaultName = name || email.split("@")[0] || "User";
        const userPassword =
          password || `${crypto.randomBytes(8).toString("hex")}A1!`;
        const hashedPassword = await bcrypt.hash(userPassword, 10);

        const userUpdate = {
          $setOnInsert: {
            name: defaultName,
            email,
            role: "USER",
            isVerified: true,
            ...(!req.body?.isNewPassword ? { password: hashedPassword } : {}),
          },
          $set: { isEmailVerified: true },
        };

        if (phone) {
          userUpdate.$set.phone = phone;
          userUpdate.$set.mobile = phone;
        }
        if (password && req.body?.isNewPassword) {
          userUpdate.$set.password = hashedPassword;
        }

        user = await User.findOneAndUpdate({ email }, userUpdate, {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true,
        });
      }
    } catch (error) {
      const conflict = getDuplicateUserConflict(error);
      if (conflict) {
        if (conflict.code === "PHONE_ALREADY_REGISTERED") {
          return phoneAlreadyRegistered(res);
        }
        if (conflict.code === "EMAIL_ALREADY_REGISTERED") {
          return emailAlreadyRegistered(res);
        }
        return res.status(409).json({ success: false, message: conflict.message });
      }
      throw error;
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }

    // ── Issue JWT & cookie ──
    const token = generateToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || user.mobile,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    const conflict = getDuplicateUserConflict(error);
    if (conflict) {
      if (conflict.code === "PHONE_ALREADY_REGISTERED") {
        return phoneAlreadyRegistered(res);
      }
      if (isRegistrationRequest && conflict.code === "EMAIL_ALREADY_REGISTERED") {
        return emailAlreadyRegistered(res);
      }
      return res.status(409).json({ success: false, message: conflict.message });
    }
    return sendUserError(res, error, "Failed to verify OTP.");
  }
};

export default {
  sendOtpController,
  resendOtpController,
  verifyOtpController,
};
