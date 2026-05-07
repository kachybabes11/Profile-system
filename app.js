import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import { requestLogger } from "./services/loggerService.js";

import { rateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiVersionMiddleware } from "./middleware/apiVersion.js";
import cors from "cors";
import multer from "multer";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

const uploadDir = path.join(os.tmpdir(), "insighta-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// Multer configuration for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
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

// CORS must be before other middleware
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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Session middleware for OAuth state management
app.use(session({
  secret: process.env.SESSION_SECRET || "your-session-secret-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 10 * 60 * 1000, // 10 minutes
  },
}));

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(requestLogger);
app.use(rateLimiter);

app.use("/api", (req, res, next) => {
  if ((req.path === "/profiles/upload/csv" || req.path === "/profiles/upload/csv/validate") && req.method === "POST") {
    return upload.single("file")(req, res, next);
  }
  next();
});

app.use("/auth", authRoutes);
app.use("/api", apiVersionMiddleware, profileRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;