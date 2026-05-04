import morgan from "morgan";

/**
 * Request Logging Middleware
 * Logs: method, endpoint, status, response time
 */

// Custom Morgan format
morgan.token("user", (req) => req.user?.username || "anonymous");
morgan.token("ms", (req, res) => {
  if (!res._header || !req._startAt) return "";
  const ms = (res._startAt[0] * 1000 + res._startAt[1] / 1000000) * 1000;
  return `${ms.toFixed(0)}ms`;
});

const logFormat =
  `:date[iso] :method :url :status :ms - User: :user - Size: :res[content-length] bytes`;

export const logger = morgan(logFormat, {
  skip: (req, res) => {
    // Skip logging for health checks
    return req.path === "/health" || req.path === "/status";
  },
});

/**
 * Custom logging for important events
 */
export function logEvent(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...metadata,
  };
  console.log(JSON.stringify(logEntry));
}

export function logAuth(action, username, success = true) {
  logEvent(success ? "INFO" : "WARN", `Auth: ${action}`, {
    action,
    username,
    success,
  });
}

export function logError(message, error, metadata = {}) {
  logEvent("ERROR", message, {
    error: error.message,
    stack: error.stack,
    ...metadata,
  });
}