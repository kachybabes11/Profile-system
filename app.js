import express from "express";
import cookieParser from "cookie-parser";
import passport from "./config/passport.js";
import session from "express-session";
import authRoutes from "./routes/authRoutes.js";
import insightRoutes from "./routes/insightRoutes.js"
import profileRoutes from "./routes/profileRoutes.js";

import { rateLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./middleware/logger.js";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(logger);
app.use(rateLimiter);

app.use(cors({
  origin: "https://profile-intelligence-fe-production.up.railway.app",
  credentials: true
}));

app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());

app.use("/auth", authRoutes);
app.use("/insighta", insightRoutes);
app.use("/api/v1", profileRoutes);

export default app;