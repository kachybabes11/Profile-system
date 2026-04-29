import { verifyAccessToken } from "../../utils/token.js";

export function requireAuth(req, res, next) {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token && req.cookies.access) {
    token = req.cookies.access;
  }

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized"
    });
  }

  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token"
    });
  }

  req.user = decoded;
  next();
}