import type { FileFormat } from "../generated/prisma/client.js";

// Sniffs the real file type from magic bytes. The MIME type and extension
// come from the client and can be anything, so neither is trusted on its own.

export type DetectedKind = "PDF" | "DOC" | "DOCX" | "JPEG" | "PNG";

const startsWith = (buf: Buffer, bytes: number[]) =>
  buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);

export function detectFileKind(buf: Buffer): DetectedKind | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "PDF"; // %PDF-
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "PNG";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "JPEG";
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "DOC"; // OLE2
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // ZIP container: only a Word package if it holds a word/ part.
    const head = buf.subarray(0, Math.min(buf.length, 64 * 1024)).toString("latin1");
    return head.includes("word/") ? "DOCX" : null;
  }
  return null;
}

const EXTENSIONS: Record<DetectedKind, readonly string[]> = {
  PDF: ["pdf"],
  DOC: ["doc"],
  DOCX: ["docx"],
  JPEG: ["jpg", "jpeg"],
  PNG: ["png"],
};

const MIME_KIND: Record<string, DetectedKind> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/jpeg": "JPEG",
  "image/jpg": "JPEG",
  "image/png": "PNG",
};

export interface FileCheck {
  ok: boolean;
  error?: string;
  fileFormat?: FileFormat;
}

// Declared MIME, filename extension and actual bytes must all agree.
export function checkUploadedFile(buf: Buffer, filename: string, mimeType: string): FileCheck {
  const declared = MIME_KIND[mimeType];
  if (!declared) return { ok: false, error: `Unsupported file type: ${mimeType}` };

  const detected = detectFileKind(buf);
  if (!detected) return { ok: false, error: "File content is not a recognised PDF, Word or image file" };
  if (detected !== declared) {
    return { ok: false, error: `File content (${detected}) does not match declared type (${mimeType})` };
  }

  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  if (!EXTENSIONS[detected].includes(ext)) {
    return { ok: false, error: `File extension ".${ext}" does not match ${detected} content` };
  }

  const fileFormat: FileFormat =
    detected === "JPEG" ? (mimeType === "image/jpg" || ext === "jpg" ? "JPG" : "JPEG") : detected;
  return { ok: true, fileFormat };
}
