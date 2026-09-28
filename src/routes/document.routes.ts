import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import {
  createDocument,
  getDocumentSignedUrl,
  deleteDocument,
} from "../services/document.service.js";
import { InvalidFileError } from "../services/storage.service.js";
import type { DocumentType } from "../generated/prisma/client.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const documentRouter = Router();

documentRouter.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const { ownerType, ownerId, documentType } = req.body as {
        ownerType: "student" | "school" | "company" | "supervisor";
        ownerId: string;
        documentType: DocumentType;
      };

      const uploadedById = (req as any).userId;

      const document = await createDocument({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        ownerType,
        ownerId,
        documentType,
        uploadedById,
      });

      res.status(201).json(document);
    } catch (err) {
      if (err instanceof InvalidFileError) {
        return res.status(400).json({ error: err.message });
      }

      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

documentRouter.get("/:id/url", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    const url = await getDocumentSignedUrl(userId, id);

    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.startsWith("Forbidden") ? 403 : 404;

    res.status(status).json({ error: message });
  }
});

documentRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    await deleteDocument(userId, id);

    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.startsWith("Forbidden") ? 403 : 404;

    res.status(status).json({ error: message });
  }
});