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

  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  req.user = decoded;
  req.user.isAdmin = decoded.role === "admin";
  next();
}