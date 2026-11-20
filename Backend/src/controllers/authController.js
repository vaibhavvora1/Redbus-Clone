import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { consumeOtp, sendOtpController } from "./otpController.js";
import { normalizePhone } from "../utils/userFields.js";
import { sendUserError } from "../utils/userErrors.js";
import { loginSchema } from "../utils/authSchemas.js";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Clean & extract 10-digit Indian phone number
 */
export const extractTenDigitPhone = (value) => {
  if (!value) return "";
  let digits = String(value).trim().replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
};

/**
 * Format 10-digit phone to E.164 (+91XXXXXXXXXX)
 */
export const formatE164Phone = (tenDigit) => {
  return `+91${tenDigit}`;
};

/**
 * Generate standard JWT auth token
 * NEVER uses a hardcoded fallback — JWT_SECRET must be set in .env
 */
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured in environment variables.");
  }
  return jwt.sign(
    { id: user._id, role: user.role, phone: user.phone, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

/**
 * 1. FORGOT PASSWORD (INITIATE) - EMAIL OTP
 * POST /api/auth/forgot-password
 */
export const forgotPasswordController = async (req, res) => {
  try {
    const email = req.body?.email
      ? String(req.body.email).trim().toLowerCase()
      : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address.",
      });
    }

    // Delegate to email sendOtpController — set purpose for scoping
    req.body.email = email;
    req.body.purpose = "forgot-password";
    return sendOtpController(req, res);
  } catch (error) {
    return sendUserError(
      res,
      error,
      "Server error while processing forgot password."
    );
  }
};

/**
 * 2. RESET PASSWORD - EMAIL OTP
 * POST /api/auth/reset-password
 */
export const resetPasswordController = async (req, res) => {
  try {
    const email = req.body?.email
      ? String(req.body.email).trim().toLowerCase()
      : "";
    const otp = req.body?.otp ? String(req.body.otp).trim() : "";
    const newPassword = req.body?.newPassword
      ? String(req.body.newPassword)
      : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 6-digit OTP code.",
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const otpResult = await consumeOtp(email, otp, "forgot-password");
    if (!otpResult.ok) {
      return res
        .status(otpResult.status)
        .json({ success: false, message: otpResult.message });
    }

    // Update user password
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    return sendUserError(res, error, "Failed to reset password.");
  }
};

/**
 * 3. LOGIN (Supports email or phone + password)
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message:
          parseResult.error.issues[0]?.message ||
          "Please provide valid login details.",
      });
    }

    const {
      phone: rawPhone,
      mobile: altMobile,
      email,
      identifier,
      password,
    } = parseResult.data;
    const input = String(
      identifier || email || rawPhone || altMobile || ""
    ).trim();
    const normalizedPhone = normalizePhone(input);
    let user = null;

    if (normalizedPhone && /^\+91[6-9]\d{9}$/.test(normalizedPhone)) {
      const tenDigit = normalizedPhone.slice(3);
      user = await User.findOne({
        $or: [
          { phone: normalizedPhone },
          { mobile: normalizedPhone },
          { phone: tenDigit },
          { mobile: tenDigit },
        ],
      });
    } else {
      user = await User.findOne({ email: input.toLowerCase() });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: input.includes("@")
          ? "No account found with this email. Please register."
          : "No account found with this mobile number. Please register.",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
      });
    }

    // Check if user was registered with Google only (no password)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          "This account was registered using Google Sign-In. Please sign in with Google or reset your password.",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password.",
      });
    }

    const token = generateToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || user.mobile,
        mobile: user.mobile || user.phone,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    return sendUserError(res, error, "Server error during login.");
  }
};

/**
 * 4. GOOGLE OAUTH LOGIN / SIGNUP
 * POST /api/auth/google
 */
export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google ID token credential is required.",
      });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.status(500).json({
        success: false,
        message: "GOOGLE_CLIENT_ID is not configured in server environment.",
      });
    }

    const client = new OAuth2Client(googleClientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
    } catch {
      return res.status(401).json({
        success: false,
        message: "Google ID token verification failed.",
      });
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Google account email is unverified or missing.",
      });
    }

    const googleId = String(payload.sub || "").trim();
    const email = payload.email.toLowerCase().trim();
    const name =
      payload.name || payload.given_name || email.split("@")[0] || "Google User";
    const avatar = payload.picture || "";

    // Find user by googleId or email
    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (user) {
      let needsSave = false;
      // Link googleId if user existed by email without googleId
      if (!user.googleId) {
        user.googleId = googleId;
        needsSave = true;
      }
      if (!user.avatar && avatar) {
        user.avatar = avatar;
        needsSave = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    } else {
      // Race-safe create: catch E11000 duplicate key and re-fetch
      try {
        user = await User.create({
          name,
          email,
          googleId,
          avatar,
          role: "USER",
          isEmailVerified: true,
          isVerified: true,
        });
      } catch (createError) {
        if (createError.code === 11000) {
          user = await User.findOne({ $or: [{ googleId }, { email }] });
          if (!user) throw createError;
        } else {
          throw createError;
        }
      }
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support.",
      });
    }

    const token = generateToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || user.mobile,
        mobile: user.mobile || user.phone,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    return sendUserError(res, error, "Server error during Google login.");
  }
};

/**
 * 5. GET ME (Current User)
 * GET /api/auth/me
 */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || req.user.mobile,
        mobile: req.user.mobile || req.user.phone,
        role: req.user.role,
        avatar: req.user.avatar,
        isEmailVerified: req.user.isEmailVerified,
      },
    });
  } catch (error) {
    return sendUserError(res, error, "Failed to retrieve user profile.");
  }
};

/**
 * 6. LOGOUT
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", COOKIE_OPTIONS);
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return sendUserError(res, error, "Failed to logout.");
  }
};

export default {
  forgotPasswordController,
  resetPasswordController,
  login,
  googleLogin,
  getMe,
  logout,
  extractTenDigitPhone,
  formatE164Phone,
};
