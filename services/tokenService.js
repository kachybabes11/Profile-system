import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createHash } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";
const ACCESS_TOKEN_EXPIRY = "3m"; // 3 minutes
const REFRESH_TOKEN_EXPIRY = "5m"; // 5 minutes

/**
 * Generate access token (3 minutes)
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      type: "access",
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate refresh token (5 minutes)
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      type: "refresh",
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Hash token for storage
 */
export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate PKCE code verifier
 */
export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate PKCE code challenge from verifier
 */
export function generateCodeChallenge(codeVerifier) {
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate state for OAuth
 */
export function generateState() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Extract token from Authorization header or cookies
 */
export function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  // Check cookies
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
}

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashToken,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  extractToken,
};
