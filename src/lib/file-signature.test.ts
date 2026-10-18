import assert from "node:assert/strict";
import { test } from "node:test";
import { checkUploadedFile, detectFileKind } from "./file-signature.js";

const pdf = Buffer.from("%PDF-1.7\n...");
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....word/document.xml")]);
const plainZip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....other/file.txt")]);

test("detects real formats from magic bytes", () => {
  assert.equal(detectFileKind(pdf), "PDF");
  assert.equal(detectFileKind(png), "PNG");
  assert.equal(detectFileKind(jpg), "JPEG");
  assert.equal(detectFileKind(docx), "DOCX");
  assert.equal(detectFileKind(plainZip), null);
  assert.equal(detectFileKind(Buffer.from("<script>alert(1)</script>")), null);
});

test("accepts a file whose MIME, extension and bytes agree", () => {
  assert.deepEqual(checkUploadedFile(pdf, "letter.pdf", "application/pdf"), { ok: true, fileFormat: "PDF" });
  assert.equal(checkUploadedFile(jpg, "me.jpg", "image/jpeg").fileFormat, "JPG");
  assert.equal(checkUploadedFile(jpg, "me.jpeg", "image/jpeg").fileFormat, "JPEG");
});

test("rejects a spoofed MIME type", () => {
  const r = checkUploadedFile(Buffer.from("<html></html>"), "evil.pdf", "application/pdf");
  assert.equal(r.ok, false);
});

test("rejects content that contradicts the declared type", () => {
  assert.equal(checkUploadedFile(png, "a.pdf", "application/pdf").ok, false);
});

test("rejects a mismatched extension", () => {
  assert.equal(checkUploadedFile(pdf, "letter.exe", "application/pdf").ok, false);
  assert.equal(checkUploadedFile(pdf, "noextension", "application/pdf").ok, false);
});

test("rejects unsupported MIME types", () => {
  assert.equal(checkUploadedFile(pdf, "a.pdf", "text/html").ok, false);
});
