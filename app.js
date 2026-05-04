import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";

import { rateLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./middleware/logger.js";
import { apiVersionMiddleware } from "./middleware/apiVersion.js";
import { csrfTokenMiddleware, validateCsrfToken } from "./middleware/csrf.js";
import cors from "cors";
import multer from "multer";

const app = express();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Keep files in memory for streaming
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

app.use(express.json());
app.use(cookieParser());
app.use(logger);
app.use(rateLimiter);

const allowedOrigins = [
  "https://profile-system-production.up.railway.app", // Backend itself
  "http://localhost:3000", // Local development
  "http://localhost:4000"  // Local frontend
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// Session middleware only needed for CSRF protection
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || "changeme",
  resave: false,
  saveUninitialized: false
}));

// Add upload middleware to profile routes that need it
app.use("/api", (req, res, next) => {
  if (req.path === "/profiles/upload/csv" && req.method === "POST") {
    return upload.single("file")(req, res, next);
  }
  next();
});

app.use("/auth", authRoutes);
app.use("/api", apiVersionMiddleware, profileRoutes);

// CSRF protection for web routes (when implemented)
app.use("/web", csrfTokenMiddleware);
app.use("/web", validateCsrfToken);

export default app;