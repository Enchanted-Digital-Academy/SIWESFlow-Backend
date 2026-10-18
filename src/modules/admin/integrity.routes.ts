import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { auditDocumentIntegrity } from "../../services/document-integrity.service.js";

export const integrityRouter = Router();
integrityRouter.use(requireAuth, requireRole("PLATFORM_ADMIN"));

// Read-only report of database/storage/access inconsistencies for documents.
integrityRouter.get("/documents", async (_req, res) => {
  res.json(await auditDocumentIntegrity());
});
