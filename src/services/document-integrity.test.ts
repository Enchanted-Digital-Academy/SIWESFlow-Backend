import assert from "node:assert/strict";
import { test } from "node:test";
import type { Document } from "../generated/prisma/client.js";
import { auditDocumentRow } from "./document-integrity.rules.js";

const base = {
  id: "d1",
  studentId: "s1",
  schoolId: null,
  companyId: null,
  supervisorId: null,
  documentType: "PASSPORT_PHOTO",
  filename: "me.png",
  fileFormat: "PNG",
  fileSizeBytes: 100,
  storageKey: "student/s1/PASSPORT_PHOTO/u-me.png",
  uploadedById: "u1",
  uploadedAt: new Date(),
  verificationStatus: "UNVERIFIED",
  verifiedById: null,
  verifiedAt: null,
  verificationId: null,
  verification: null,
} as unknown as Document & { verification: { status: string } | null };

const codes = (doc: object, stored: Map<string, number | null>) =>
  auditDocumentRow({ ...base, ...doc } as typeof base, stored).map((i) => i.code);

test("a consistent row has no issues", () => {
  assert.deepEqual(codes({}, new Map([[base.storageKey, 100]])), []);
});

test("flags missing and mismatched storage objects", () => {
  assert.deepEqual(codes({}, new Map()), ["STORAGE_OBJECT_MISSING"]);
  assert.deepEqual(codes({}, new Map([[base.storageKey, 99]])), ["SIZE_MISMATCH"]);
});

test("flags owner and type problems", () => {
  const stored = new Map([[base.storageKey, 100]]);
  assert.ok(codes({ schoolId: "x" }, stored).includes("OWNER_COUNT"));
  assert.ok(codes({ documentType: "CAC_REGISTRATION" }, stored).includes("TYPE_NOT_ALLOWED_FOR_OWNER"));
  assert.ok(codes({ studentId: "s2" }, stored).includes("STORAGE_KEY_OWNER_MISMATCH"));
});

test("flags extension/format mismatch and missing uploader", () => {
  const stored = new Map([[base.storageKey, 100]]);
  assert.ok(codes({ fileFormat: "PDF" }, stored).includes("EXTENSION_FORMAT_MISMATCH"));
  assert.ok(codes({ uploadedById: null }, stored).includes("NO_UPLOADER"));
});

test("flags verified documents without a reviewer or a verified request", () => {
  const stored = new Map([[base.storageKey, 100]]);
  const found = codes({ verificationStatus: "VERIFIED", verification: { status: "REJECTED" } }, stored);
  assert.ok(found.includes("VERIFIED_WITHOUT_REVIEWER"));
  assert.ok(found.includes("VERIFIED_WITHOUT_VERIFIED_REQUEST"));
});
