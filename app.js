import express from "express";
import cookieParser from "cookie-parser";
import passport from "./config/passport.js";

import authRoutes from "./routes/authRoutes.js";
import insightRoutes from "./routes/insightRoutes.js"
import profileRoutes from "./routes/profileRoutes.js";

import { rateLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./middleware/logger.js";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(logger);
app.use(rateLimiter);

app.use(passport.initialize());

app.use("/auth", authRoutes);
app.use("/insighta", insightRoutes);
app.use("/api/v1", profileRoutes);

export default app;