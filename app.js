import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";

import { rateLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./middleware/logger.js";
import { apiVersionMiddleware } from "./middleware/apiVersion.js";
import cors from "cors";
import multer from "multer";

const app = express();

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

export default app;