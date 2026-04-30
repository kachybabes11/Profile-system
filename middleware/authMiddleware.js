import { verifyAccessToken } from "../utils/token.js";

export function authMiddleware(req, res, next) {
  let token;

  // 1. CLI / Postman (priority)
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // 2. Web fallback (cookie)
  if (!token && req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  try {
    const decoded = verifyAccessToken(token);

    req.user = decoded;

    // role enforcement hook
    req.user.isAdmin = decoded.role === "admin";

    next();

  } catch (err) {

    // 🔥 IMPORTANT: differentiate expiry vs invalid
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
        code: "TOKEN_EXPIRED"
      });
    }

    return res.status(401).json({
      message: "Invalid token"
    });
  }
}