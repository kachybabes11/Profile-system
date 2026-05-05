import express from "express";
import {
  getProfiles,
  searchProfiles,
  createProfile,
  getSingleProfile,
  deleteProfile,
  exportProfiles,
  uploadProfilesCSV,
  readCSVHeaders,
} from "../controllers/profileController.js";
import { requireRole } from "../middleware/requireRole.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { apiVersionMiddleware } from "../middleware/apiVersion.js";

const router = express.Router();

router.post("/profiles", apiVersionMiddleware, authMiddleware, requireRole('admin'), createProfile);
router.get("/profiles", apiVersionMiddleware, authMiddleware, requireRole('admin', 'analyst'), getProfiles);

router.get("/profiles/export", apiVersionMiddleware, authMiddleware, requireRole("admin", "analyst"), exportProfiles);
router.get("/profiles/search", apiVersionMiddleware, authMiddleware, requireRole("admin", "analyst"), searchProfiles);

router.post("/profiles/upload/csv", apiVersionMiddleware, authMiddleware, requireRole("admin"), uploadProfilesCSV);
router.post("/profiles/upload/csv/validate", apiVersionMiddleware, authMiddleware, requireRole("admin"), readCSVHeaders);

router.get("/profiles/:id", apiVersionMiddleware, authMiddleware, requireRole("admin", "analyst"), getSingleProfile);
router.delete("/profiles/:id", apiVersionMiddleware, authMiddleware, requireRole("admin"), deleteProfile);


export default router;