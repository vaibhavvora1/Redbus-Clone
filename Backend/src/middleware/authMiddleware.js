import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

/**
 * Authentication Middleware
 * Reads JWT token from HTTP-only cookie first, falls back to Bearer header.
 * Attaches authenticated user to req.user.
 */
export const authenticate = async (req, res, next) => {
  let token;

  // 1. Read token from HTTP-only cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Authorization: Bearer <token> (for curl, automated tests, or external clients)
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("[Auth] JWT_SECRET is not configured in environment variables.");
    return res.status(500).json({
      success: false,
      message: "Server authentication configuration error.",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session. Please log in again.",
    });
  }

  let user;
  try {
    user = await User.findById(decoded.id).select("-password");
  } catch (error) {
    console.error("[Auth] Failed to load authenticated user:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to verify authenticated user.",
    });
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User account no longer exists.",
    });
  }

  if (user.isBlocked) {
    return res.status(403).json({
      success: false,
      message: "Your account has been suspended. Please contact support.",
    });
  }

  req.user = user;
  next();
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} roles Allowed roles (e.g. 'ADMIN')
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access denied. Required role: ${roles.join(" or ")}`,
      });
    }

    next();
  };
};

/**
 * Require Admin Middleware
 * Checks if req.user exists (401) and if req.user.role is admin (403).
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const role = String(req.user.role || "").toLowerCase();
  if (role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Admin access required.",
    });
  }

  next();
};

/**
 * Validates Mongoose ObjectId from req.params
 * @param {string} paramName
 */
export const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid identifier format: ${id}`,
      });
    }
    next();
  };
};

/**
 * Optional Authentication Middleware
 * If a valid JWT cookie/header is present, attaches user to req.user.
 * If not authenticated, silently continues without error.
 * Used for routes accessible both by guests and logged-in users.
 */
export const optionalAuthenticate = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token || !process.env.JWT_SECRET) {
    return next(); // No token or no secret — continue without user
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (user) req.user = user;
  } catch {
    // Invalid token — ignore, treat as anonymous
  }

  next();
};
