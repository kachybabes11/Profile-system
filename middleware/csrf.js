import crypto from "crypto";

/**
 * CSRF Token Middleware
 * Generates and validates CSRF tokens for web requests
 */

export function csrfTokenMiddleware(req, res, next) {
  // Generate CSRF token if session exists and token doesn't
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  // Attach token to response locals
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

/**
 * CSRF Validation Middleware
 * Validates CSRF token on state-changing requests
 */
export function validateCsrfToken(req, res, next) {
  // Only validate on state-changing requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF check for API requests with Bearer token
  if (req.get("Authorization")?.startsWith("Bearer ")) {
    return next();
  }

  if (!req.session?.csrfToken) {
    return res.status(403).json({
      status: "error",
      message: "CSRF token missing",
    });
  }

  const token = req.get("X-CSRF-Token") || req.body._csrf;

  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({
      status: "error",
      message: "Invalid CSRF token",
    });
  }

  next();
}

export default { csrfTokenMiddleware, validateCsrfToken };
