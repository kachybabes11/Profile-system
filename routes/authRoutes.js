import express from "express";
import * as oauthService from "../services/oauthService.js";
import * as userModel from "../models/userModel.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashToken,
} from "../services/tokenService.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { logAuth, logSecurity } from "../services/loggerService.js";

const isProduction = process.env.NODE_ENV === "production";
const webCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

const router = express.Router();

// Apply auth rate limiter to all auth routes
router.use(authRateLimiter);

/**
 * GET /auth/github
 * Redirect to GitHub OAuth (for web) with PKCE
 */
router.get("/github", (req, res) => {
  try {
    const { url } =
      oauthService.getGitHubAuthorizationUrlWithPKCE();

    return res.redirect(url);
  } catch (err) {
    logSecurity("Failed to initiate web OAuth", {
      error: err.message,
    });

    return res.status(500).json({
      status: "error",
      message: "Failed to initialize OAuth",
    });
  }
});


/**
 * GET /auth/github/callback
 * Handle GitHub OAuth callback (for both web and CLI)
 */
router.get("/github/callback", async (req, res) => {
  try {
    const { code, error, error_description, state } = req.query;

    if (error) {
      const errorMessage = error_description || error;
      logSecurity("GitHub OAuth error", { error: errorMessage, state });

      // Check if CLI flow
      const stateEntry = state ? oauthService.peekOAuthState(state) : null;
      const isCliFlow = stateEntry?.type === "cli";

      if (isCliFlow) {
        return res.status(400).json({
          status: "error",
          message: "GitHub authorization failed",
          details: errorMessage,
        });
      }

      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:4000"}/?error=${encodeURIComponent(
          errorMessage
        )}`
      );
    }

    if (!code || !state) {
      logSecurity("Missing code or state in OAuth callback", { code: !!code, state: !!state });
      return res.status(400).json({
        status: "error",
        message: "Missing authorization code or state",
      });
    }

    // Get code verifier from state
    const stateEntry = oauthService.peekOAuthState(state);
    if (!stateEntry) {
      logSecurity("Invalid OAuth state", { state });
      return res.status(400).json({
        status: "error",
        message: "Invalid OAuth state",
      });
    }

    const isCliFlow = stateEntry.type === "cli";
    const codeVerifier = stateEntry.codeVerifier;

    const { user, accessToken, refreshToken } = await oauthService.completeOAuthFlow(
      code,
      "/auth/github/callback",
      codeVerifier,
      state
    );

    if (isCliFlow) {
      logAuth("CLI login success", user.username);
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
    }

    logAuth("Web login success", user.username);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4000";

    const redirectUrl =
      `${frontendUrl}/auth/callback` +
      `?access_token=${encodeURIComponent(accessToken)}` +
      `&refresh_token=${encodeURIComponent(refreshToken)}`;

return res.redirect(redirectUrl);
  } catch (err) {
    logSecurity("OAuth callback error", { error: err.message });
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4000";
    res.redirect(
      `${frontendUrl}/?error=${encodeURIComponent(
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

    const { url, state } = oauthService.getGitHubAuthorizationUrlForCLI(codeVerifier);

    return res.json({
      status: "success",
      auth_url: url,
      state,
    });

  } catch (err) {
    logSecurity("Failed to initiate CLI OAuth", { error: err.message });
    return res.status(500).json({
      status: "error",
      message: "Failed to initiate login",
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
    const refreshToken = req.body.refresh_token || req.cookies?.refreshToken;

    if (!refreshToken) {
      logSecurity("Refresh attempt without token", { ip: req.ip });
      return res.status(401).json({
        status: "error",
        message: "Missing refresh token",
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== "refresh") {
      logSecurity("Invalid refresh token", { ip: req.ip });
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired refresh token",
      });
    }

    // Check if token exists and is not revoked in database
    const tokenHash = hashToken(refreshToken);
    const storedToken = await userModel.verifyRefreshToken(tokenHash);
    if (!storedToken) {
      logSecurity("Revoked refresh token used", { userId: decoded.userId, ip: req.ip });
      return res.status(401).json({
        status: "error",
        message: "Refresh token has been revoked",
      });
    }

    // Fetch fresh user data
    const user = await userModel.findById(decoded.userId);
    if (!user || !user.is_active) {
      logSecurity("Inactive user refresh attempt", { userId: decoded.userId, username: user?.username });
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

    logAuth("Token refresh", user.username);

    // Set cookies for web
    res.cookie("accessToken", newAccessToken, {
      ...webCookieOptions,
      maxAge: 3 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      ...webCookieOptions,
      maxAge: 5 * 60 * 1000,
    });

    res.json({
      status: "success",
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: 180,
    });
  } catch (err) {
    logError("Token refresh error", err);
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

    logAuth("Logout", req.user.username);

    // Clear cookies
    res.clearCookie("accessToken", {
      ...webCookieOptions,
      maxAge: 0,
    });
    res.clearCookie("refreshToken", {
      ...webCookieOptions,
      maxAge: 0,
    });

    res.json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (err) {
    logError("Logout error", err);
    res.status(500).json({
      status: "error",
      message: "Failed to logout",
    });
  }
});

/**
 * GET /auth/me
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
    logError("Get user info error", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user info",
    });
  }
});

export default router;