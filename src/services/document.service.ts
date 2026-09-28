import type { Document, DocumentType } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  uploadDocumentFile,
  getSignedDocumentUrl,
  deleteDocumentFile,
} from "./storage.service.js";

type OwnerType = "student" | "school" | "company" | "supervisor";

const MIME_TO_FILE_FORMAT: Record<string, "PDF" | "DOC" | "DOCX" | "JPG" | "JPEG" | "PNG"> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "image/jpeg": "JPEG",
  "image/jpg": "JPG",
  "image/png": "PNG",
};

export async function createDocument(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  ownerType: OwnerType;
  ownerId: string;
  documentType: DocumentType;
  uploadedById: string;
}): Promise<Document> {
  const { buffer, filename, mimeType, ownerType, ownerId, documentType, uploadedById } =
    params;

  const fileFormat = MIME_TO_FILE_FORMAT[mimeType];
  if (!fileFormat) {
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  const { storageKey, fileSizeBytes } = await uploadDocumentFile({
    buffer,
    filename,
    mimeType,
    ownerType,
    ownerId,
    documentType,
  });

  const ownerField = `${ownerType}Id` as
    | "studentId"
    | "schoolId"
    | "companyId"
    | "supervisorId";

  return prisma.document.create({
    data: {
      [ownerField]: ownerId,
      documentType,
      filename,
      fileFormat,
      fileSizeBytes,
      storageKey,
      uploadedById,
    },
  });
}

export async function canUserAccessDocument(
  userId: string,
  document: Document
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: true, supervisorProfile: true },
  });
  if (!user) return false;

  if (user.role === "PLATFORM_ADMIN") return true;
  if (document.uploadedById === userId) return true;

  if (document.studentId && user.student?.id === document.studentId) {
    return true;
  }
  if (
    document.studentId &&
    user.supervisorProfile &&
    (await prisma.student.findFirst({
      where: { id: document.studentId, supervisorId: user.supervisorProfile.id },
    }))
  ) {
    return true;
  }
  if (user.role === "SCHOOL_COORDINATOR" && document.schoolId) {
    const coordinatesThisSchool = await prisma.school.findFirst({
      where: { id: document.schoolId, coordinatorId: userId },
    });
    if (coordinatesThisSchool) return true;
  }

  return false;
}

export async function getDocumentSignedUrl(
  userId: string,
  documentId: string
): Promise<string> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document) {
    throw new Error("Document not found");
  }

  const allowed = await canUserAccessDocument(userId, document);
  if (!allowed) {
    throw new Error("Forbidden: no permission to access this document");
  }

  return getSignedDocumentUrl(document.storageKey);
}

export async function deleteDocument(
  userId: string,
  documentId: string
): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document) {
    throw new Error("Document not found");
  }

  const allowed = await canUserAccessDocument(userId, document);
  if (!allowed) {
    throw new Error("Forbidden: no permission to delete this document");
  }

  await deleteDocumentFile(document.storageKey);
  await prisma.document.delete({ where: { id: documentId } });
}