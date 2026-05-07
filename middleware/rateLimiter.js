import rateLimit from "express-rate-limit";
import { logSecurity } from "../services/loggerService.js";

/**
 * Rate Limiter for Auth Endpoints
 * 10 requests per minute per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => {
    return req.ip;
  },
  message: {
    status: "error",
    message: "Too many authentication attempts. Please try again later.",
  },
  standardHeaders: false,
  onLimitReached: (req) => {
    logSecurity("Rate limit exceeded on auth endpoint", {
      ip: req.ip,
      endpoint: req.url,
      method: req.method,
    });
  },
});

/**
 * Rate Limiter for API Endpoints
 * 60 requests per minute per user (or IP if not authenticated)
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.userId || req.ip;
  },
  message: {
    status: "error",
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: false,
  skip: (req) => req.method === "GET", // Less restrictive on reads
  onLimitReached: (req) => {
    logSecurity("Rate limit exceeded on API endpoint", {
      ip: req.ip,
      user: req.user?.username || "anonymous",
      endpoint: req.url,
      method: req.method,
    });
  },
});

/**
 * Global rate limiter (fallback)
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    status: "error",
    message: "Too many requests",
  },
  onLimitReached: (req) => {
    logSecurity("Global rate limit exceeded", {
      ip: req.ip,
      endpoint: req.url,
      method: req.method,
    });
  },
});