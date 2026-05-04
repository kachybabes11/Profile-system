import { extractToken, verifyToken } from "../services/tokenService.js";
import * as userModel from "../models/userModel.js";

export function authMiddleware(req, res, next) {
  try {
    // Extract token from header or cookies
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized - No token provided",
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== "access") {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired token",
      });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(401).json({
      status: "error",
      message: "Authentication failed",
    });
  }
}

export function optionalAuthMiddleware(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.type === "access") {
        req.user = decoded;
      }
    }

    next();
  } catch (err) {
    // Continue without auth
    next();
  }
}