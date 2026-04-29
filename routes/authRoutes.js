import express from "express";
import passport from "../config/passport.js";
import { githubCallback } from "../controllers/authController.js";
import jwt from "jsonwebtoken";

const router = express.Router();

router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false }),
  githubCallback
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