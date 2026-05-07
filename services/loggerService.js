import winston from "winston";

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "profile-system" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // In production, add file transport
    ...(process.env.NODE_ENV === "production"
      ? [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
          }),
          new winston.transports.File({
            filename: "logs/combined.log",
          }),
        ]
      : []),
  ],
});

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.user?.username || "anonymous",
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
  });

  next();
};

// Auth logging
export const logAuth = (action, username, success = true, metadata = {}) => {
  logger.info("Auth event", {
    action,
    username,
    success,
    ...metadata,
  });
};

// Error logging
export const logError = (message, error, metadata = {}) => {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...metadata,
  });
};

// Security logging
export const logSecurity = (event, metadata = {}) => {
  logger.warn("Security event", {
    event,
    ...metadata,
  });
};

export default logger;