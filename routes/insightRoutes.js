import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/me", authMiddleware, (req, res) => {
  res.json(req.user);
});

router.get("/role", authMiddleware, (req, res) => {
  res.json({ role: req.user.role });
});

export default router;