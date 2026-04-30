import express from "express";
import cookieParser from "cookie-parser";
import passport from "./config/passport.js";
import session from "express-session";
import authRoutes from "./routes/authRoutes.js";
import insightRoutes from "./routes/insightRoutes.js"
import profileRoutes from "./routes/profileRoutes.js";

import { rateLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./middleware/logger.js";
import { checkApiVersion } from "./middleware/checkVersion.js";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(logger);
app.use(rateLimiter);

const allowedOrigins = [
  "https://profile-intelligence-fe-production.up.railway.app",
  "http://localhost:4000"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || "changeme",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());

app.use("/auth", authRoutes);
app.use("/insighta", insightRoutes);
app.use("/api/v1", checkApiVersion, profileRoutes);

export default app;