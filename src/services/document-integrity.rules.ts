import type { Document } from "../generated/prisma/client.js";
import { ownerOf, TYPES_BY_OWNER } from "../modules/access/document-policy.js";

// Pure per-row checks for the document integrity audit, kept free of database
// and storage imports so they can be unit tested.

export type IssueCode =
  | "OWNER_COUNT"
  | "TYPE_NOT_ALLOWED_FOR_OWNER"
  | "STORAGE_OBJECT_MISSING"
  | "SIZE_MISMATCH"
  | "STORAGE_KEY_OWNER_MISMATCH"
  | "EXTENSION_FORMAT_MISMATCH"
  | "ORPHAN_STORAGE_OBJECT"
  | "NO_UPLOADER"
  | "VERIFIED_WITHOUT_REVIEWER"
  | "VERIFIED_WITHOUT_VERIFIED_REQUEST";

export interface IntegrityIssue {
  code: IssueCode;
  documentId?: string;
  storageKey?: string;
  detail: string;
}

export interface IntegrityReport {
  checkedAt: string;
  documentsChecked: number;
  storageObjects: number;
  issueCount: number;
  issues: IntegrityIssue[];
}

const FORMAT_EXTENSIONS: Record<string, string[]> = {
  PDF: ["pdf"],
  DOC: ["doc"],
  DOCX: ["docx"],
  JPG: ["jpg", "jpeg"],
  JPEG: ["jpg", "jpeg"],
  PNG: ["png"],
};

const extensionOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

// Storage keys are `${ownerType}/${ownerId}/${documentType}/${uuid}-${name}`.
export function auditDocumentRow(
  doc: Document & { verification: { status: string } | null },
  stored: Map<string, number | null>
): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const at = (code: IssueCode, detail: string): void => {
    issues.push({ code, documentId: doc.id, storageKey: doc.storageKey, detail });
  };

  const owners = [doc.studentId, doc.schoolId, doc.companyId, doc.supervisorId].filter(Boolean).length;
  if (owners !== 1) at("OWNER_COUNT", `Document has ${owners} owners; exactly one is required`);

  const owner = ownerOf(doc);
  if (owner) {
    if (!TYPES_BY_OWNER[owner.type].includes(doc.documentType)) {
      at("TYPE_NOT_ALLOWED_FOR_OWNER", `${doc.documentType} is not valid for a ${owner.type}`);
    }
    const [keyOwnerType, keyOwnerId] = doc.storageKey.split("/");
    if (keyOwnerType !== owner.type || keyOwnerId !== owner.id) {
      at("STORAGE_KEY_OWNER_MISMATCH", `Storage key belongs to ${keyOwnerType}/${keyOwnerId}, row to ${owner.type}/${owner.id}`);
    }
  }

  if (!stored.has(doc.storageKey)) {
    at("STORAGE_OBJECT_MISSING", "No object exists in storage for this row");
  } else {
    const size = stored.get(doc.storageKey);
    if (size !== null && size !== undefined && size !== doc.fileSizeBytes) {
      at("SIZE_MISMATCH", `Row says ${doc.fileSizeBytes} bytes, storage has ${size}`);
    }
  }

  const ext = extensionOf(doc.filename);
  if (!FORMAT_EXTENSIONS[doc.fileFormat]?.includes(ext)) {
    at("EXTENSION_FORMAT_MISMATCH", `Filename extension ".${ext}" does not match format ${doc.fileFormat}`);
  }

  if (!doc.uploadedById) at("NO_UPLOADER", "Uploader is unknown, so deletion rights cannot be resolved");
  if (doc.verificationStatus === "VERIFIED") {
    if (!doc.verifiedById) at("VERIFIED_WITHOUT_REVIEWER", "Marked VERIFIED but no reviewer is recorded");
    if (doc.verification && doc.verification.status !== "VERIFIED") {
      at("VERIFIED_WITHOUT_VERIFIED_REQUEST", `Marked VERIFIED but its request is ${doc.verification.status}`);
    }
  }
  return issues;
}

