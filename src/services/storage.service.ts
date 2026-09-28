import { randomUUID } from "node:crypto";
import { supabase, DOCUMENTS_BUCKET } from "../lib/supabase.js";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class InvalidFileError extends Error {}

export interface UploadResult {
  storageKey: string;
  fileSizeBytes: number;
}

export async function uploadDocumentFile(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  ownerType: "student" | "school" | "company" | "supervisor";
  ownerId: string;
  documentType: string;
}): Promise<UploadResult> {
  const { buffer, filename, mimeType, ownerType, ownerId, documentType } =
    params;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new InvalidFileError(`Unsupported file type: ${mimeType}`);
  }
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new InvalidFileError(
      `File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`
    );
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${ownerType}/${ownerId}/${documentType}/${randomUUID()}-${safeFilename}`;

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storageKey, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return { storageKey, fileSizeBytes: buffer.byteLength };
}

export async function getSignedDocumentUrl(
  storageKey: string,
  expiresInSeconds = 300
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds);

  if (error || !data) {
    throw new Error(
      `Failed to create signed URL: ${error?.message ?? "unknown error"}`
    );
  }

  return data.signedUrl;
}

export async function deleteDocumentFile(storageKey: string): Promise<void> {
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([storageKey]);

  if (error) {
    throw new Error(`Supabase Storage delete failed: ${error.message}`);
  }
}