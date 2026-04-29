import express from "express";
import {
  getProfiles,
  searchProfiles,
  createProfile,
  getSingleProfile,
  deleteProfile,
  exportProfiles,
} from "../controllers/profileController.js";
import { requireRole } from "../middleware/requireRole.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/profiles", authMiddleware, requireRole('admin'), createProfile);
router.get("/profiles", authMiddleware, requireRole("admin"), getProfiles);

router.get("/profiles/export", authMiddleware, requireRole("admin"), exportProfiles)
router.get("/profiles/search", searchProfiles);

router.get("/profiles/:id", getSingleProfile);
router.delete("/profiles/:id",authMiddleware,  requireRole("admin"), deleteProfile);


export default router;