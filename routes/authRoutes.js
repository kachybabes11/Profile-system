import express from "express";
import * as oauthService from "../services/oauthService.js";
import * as userModel from "../models/userModel.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashToken,
  extractToken,
} from "../services/tokenService.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /auth/github
 * Redirect to GitHub OAuth (for web)
 */
router.get("/github", (req, res) => {
  const authUrl = oauthService.getGitHubAuthorizationUrl();
  res.redirect(authUrl);
});

/**
 * GET /auth/github/callback
 * Handle GitHub OAuth callback (for web)
 */
router.get("/github/callback", async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    console.log("\n[WEB OAuth Callback]", {
      code: code ? `${code.substring(0, 10)}...` : null,
      error,
      error_description,
    });

    if (error) {
      console.error(`[WEB OAuth Error] GitHub rejected authorization: ${error_description}`);
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:4000"}/login?error=${encodeURIComponent(
          error_description || error
        )}`
      );
    }

    if (!code) {
      console.error("[WEB OAuth Error] Missing authorization code in callback");
      return res.status(400).json({
        status: "error",
        message: "Missing authorization code",
        hint: "GitHub did not return an authorization code. Check that redirect_uri matches GitHub app settings.",
      });
    }

    // Complete OAuth FLOW

    const { user, accessToken, refreshToken } = await oauthService.completeOAuthFlow(code, "/auth/github/callback");

    console.log(`[WEB OAuth Success] User ${user.username} authenticated`);

    // Set HTTP-only cookies (web)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3 * 60 * 1000, // 3 minutes
    });
  
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60 * 1000, // 5 minutes
    });

    // Redirect to web app
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4000";
    res.redirect(`${frontendUrl}/dashboard`);
  } catch (err) {
    console.error("[WEB OAuth Error] Authentication flow failed:", err.message);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4000";
    res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(
        "Authentication failed: " + err.message
      )}`
    );
  }
});

/**
 * POST /auth/cli/login
 * Initiate CLI OAuth flow (returns auth URL)
 */
router.post("/cli/login", (req, res) => {
  try {
    const { codeVerifier } = req.body;

    if (!codeVerifier) {
      return res.status(400).json({
        status: "error",
        message: "Missing codeVerifier",
      });
    }

    const { url, state } = oauthService.getGitHubAuthorizationUrlWithPKCE(codeVerifier);

    return res.json({
      status: "success",
      auth_url: url,
      state,
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: "Failed to initiate login",
      details: err.message,
    });
  }
});

/**
 * GET /auth/cli/callback
 * CLI OAuth callback (exchange code for tokens)
 */
router.get("/cli/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    console.log("\n[CLI OAuth Callback]", {
      code: code ? code.substring(0, 10) : null,
      state: state ? `${state.substring(0, 10)}...` : null,
    });

    if (!code) {
      return res.status(400).json({
        status: "error",
        message: "Missing authorization code",
      });
    }

    const { user, accessToken, refreshToken } =
      await oauthService.completeOAuthFlow(
        code,
        "/auth/cli/callback",
        undefined,
        state
      );

    return res.json({
      status: "success",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 180,
    });

  } catch (err) {
    console.error("[CLI OAuth Error]", err.message);

    return res.status(401).json({
      status: "error",
      message: "Authentication failed",
      details: err.message,
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(401).json({
        status: "error",
        message: "Missing refresh token",
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refresh_token);
    if (!decoded || decoded.type !== "refresh") {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired refresh token",
      });
    }

    // Check if token exists and is not revoked in database
    const tokenHash = hashToken(refresh_token);
    const storedToken = await userModel.verifyRefreshToken(tokenHash);
    if (!storedToken) {
      return res.status(401).json({
        status: "error",
        message: "Refresh token has been revoked",
      });
    }

    // Fetch fresh user data
    const user = await userModel.findById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(403).json({
        status: "error",
        message: "User is not active",
      });
    }

    // Revoke old refresh token
    await userModel.revokeRefreshToken(tokenHash);

    // Generate new token pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Store new refresh token
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await userModel.storeRefreshToken(user.id, newTokenHash, expiresAt);

    // Set cookies for web
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60 * 1000,
    });

    res.json({
      status: "success",
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 180,
    });
  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to refresh token",
    });
  }
});

/**
 * POST /auth/logout
 * Logout and revoke tokens
 */
router.post("/logout", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Revoke all user's refresh tokens
    await userModel.revokeAllUserTokens(userId);

    // Clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to logout",
    });
  }
});

/**
 * GET /me
 * Get current user info
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user info",
    });
  }
});

export default router;