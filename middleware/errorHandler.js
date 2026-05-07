import { logError } from "../services/loggerService.js";

/**
 * Centralized Error Handling Middleware
 * All errors should follow the format: { status: "error", message: "..." }
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error
  logError("Request error", err, {
    method: req.method,
    url: req.url,
    user: req.user?.username || "anonymous",
    ip: req.ip,
  });

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      status: "error",
      message: "Validation failed",
      details: messages,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      status: "error",
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      message: "Token expired",
    });
  }

  // Database errors
  if (err.code === "23505") { // Unique constraint violation
    return res.status(409).json({
      status: "error",
      message: "Resource already exists",
    });
  }

  if (err.code === "23503") { // Foreign key constraint violation
    return res.status(400).json({
      status: "error",
      message: "Invalid reference",
    });
  }

  // Multer file upload errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      status: "error",
      message: "File too large",
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      status: "error",
      message: "Unexpected file field",
    });
  }

  // Rate limiting
  if (err.status === 429) {
    return res.status(429).json({
      status: "error",
      message: "Too many requests",
    });
  }

  // Default error response
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    status: "error",
    message: statusCode >= 500 ? "Internal server error" : message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};