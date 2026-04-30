import express from "express";
import passport from "../config/passport.js"
import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/token.js";
import dotenv from "dotenv"
dotenv.config()

const router = express.Router();

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get("/github/callback",
  passport.authenticate("github", {
    session: false
  }),
  (req, res) => {

    const user = req.user;

    const payload = {
      id: user.id,
      username: user.username || user.displayName,
      role: user.username === "kachybabes11" ? "admin" : "analyst"
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 🟢 1. FOR WEB (COOKIE)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/"
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/"
    });

    // 🟡 2. FOR CLI (TOKEN RETURN OPTION)
    const isCLI = req.query.source === "cli";

    if (isCLI) {
      return res.json({
        accessToken,
        refreshToken
      });
    }

    // WEB REDIRECT
    return res.redirect(
      "https://profile-intelligence-fe-production.up.railway.app/dashboard"
    );
  }
);

router.post("/cli-login", (req, res) => {
  const { username } = req.body;

  const role =
    username === "kachybabes11" ? "admin" : "analyst";

  const payload = {
    username,
    role,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "30m",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });

  res.json({
    accessToken,
    refreshToken,
    user: payload,
  });
});

router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      message: "No refresh token"
    });
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const newAccessToken = jwt.sign(
      {
        username: decoded.username,
        role: decoded.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "30m" }
    );

    res.json({
      accessToken: newAccessToken
    });

  } catch (err) {
    return res.status(401).json({
      message: "Invalid refresh token"
    });
  }
});

router.post("/cli-logout", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(400).json({
      status: "error",
      message: "No token provided"
    });
  }

  // In real systems you'd blacklist token, but for your project:
  // we just acknowledge logout

  res.json({
    status: "success",
    message: "Logged out successfully"
  });
});

export default router;