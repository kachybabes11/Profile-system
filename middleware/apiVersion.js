/**
 * API Versioning Middleware
 * Requires X-API-Version header on all /api/* requests
 */
export function apiVersionMiddleware(req, res, next) {
  // X-API-Version is required for all API routes mounted here.
  // This middleware is only applied to /api/* endpoints.
  if (req.path.includes("/health") || req.path.includes("/status")) {
    return next();
  }

  const apiVersion = req.get("X-API-Version");

  if (!apiVersion) {
    return res.status(400).json({
      status: "error",
      message: "API version header required",
    });
  }

  const version = parseInt(apiVersion, 10);
  if (isNaN(version) || version < 1) {
    return res.status(400).json({
      status: "error",
      message: "Invalid API version",
    });
  }

  // Currently support only v1
  if (version !== 1) {
    return res.status(400).json({
      status: "error",
      message: `API version ${version} not supported`,
    });
  }

  req.apiVersion = version;
  next();
}

export default apiVersionMiddleware;
