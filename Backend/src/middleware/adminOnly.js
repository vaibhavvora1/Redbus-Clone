/**
 * Admin Only Authorization Middleware
 * Runs after the authentication middleware (which sets req.user).
 * Returns 401 if unauthenticated, 403 if user role is not admin.
 */
export const adminOnly = (req, res, next) => {
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
      message: "Forbidden: Admin privileges required.",
    });
  }

  next();
};

export default adminOnly;
