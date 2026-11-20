/**
 * Central Error-Handling Middleware
 * Provides standardized JSON error responses across all routes.
 */
import { getDuplicateUserConflict } from "../utils/userErrors.js";
import { formatValidationIssues } from "../utils/validation.js";

export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (err, req, res, next) => {
  // Body-parser malformed JSON payload
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Malformed JSON payload in request body.",
    });
  }

  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formatValidationIssues(err.issues || []),
    });
  }

  if (Array.isArray(err.validationErrors)) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: "Validation failed",
      errors: err.validationErrors,
      ...(typeof err.code === "string" ? { code: err.code } : {}),
    });
  }

  // Mongoose Validation Error
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.entries(err.errors || {}).map(([field, issue]) => ({
        field,
        message: issue.message || "Invalid value.",
      })),
    });
  }

  // Mongoose Cast Error (Invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid format for field: ${err.path}`,
    });
  }

  // MongoDB Duplicate Key Error
  const duplicateConflict = getDuplicateUserConflict(err);
  if (duplicateConflict) {
    return res.status(409).json({ success: false, ...duplicateConflict });
  }

  // CORS Origin Blocked
  if (err.message && err.message.includes("Not allowed by CORS")) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  // Custom or standard HTTP status
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const isDatabaseError = /^Mongo|^Mongoose/.test(err.name || "");

  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }

  return res.status(statusCode).json({
    success: false,
    ...(typeof err.code === "string" ? { code: err.code } : {}),
    message: process.env.NODE_ENV === "production" && (statusCode >= 500 || isDatabaseError)
      ? "Internal server error."
      : err.message || "Internal server error.",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default { errorHandler, notFoundHandler };
