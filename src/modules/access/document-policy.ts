import type { Document, DocumentType } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { isAdmin, type Actor } from "./actor.js";
import {
  companyRelation,
  schoolRelation,
  studentRelation,
  supervisorRelation,
} from "./relations.js";

export type OwnerType = "student" | "school" | "company" | "supervisor";
export const OWNER_TYPES: readonly OwnerType[] = ["student", "school", "company", "supervisor"];

// Which document types can be attached to which kind of owner.
export const TYPES_BY_OWNER: Record<OwnerType, readonly DocumentType[]> = {
  student: [
    "PASSPORT_PHOTO",
    "STUDENT_ID_CARD",
    "GOVERNMENT_ID",
    "ACCEPTANCE_LETTER",
    "PLACEMENT_LETTER",
    "SCHOOL_INTRO_LETTER",
    "ACTIVITY_EVIDENCE",
    "COMPLETION_LETTER",
    "COMPLETION_CERTIFICATE",
    "OTHER",
  ],
  school: ["ACCREDITATION_DOCUMENT", "SIWES_GUIDELINES", "SCHOOL_INTRO_LETTER", "OTHER"],
  company: ["CAC_REGISTRATION", "BUSINESS_REGISTRATION", "OTHER"],
  supervisor: ["GOVERNMENT_ID", "PROOF_OF_EMPLOYMENT", "OTHER"],
};

// Issued by someone other than the student, so a student cannot upload them
// for themselves.
const ISSUED_TO_STUDENT: readonly DocumentType[] = [
  "SCHOOL_INTRO_LETTER",
  "COMPLETION_LETTER",
  "COMPLETION_CERTIFICATE",
];

// Student documents a host (supervisor / company) may read. Identity documents
// stay between the student, their school and the platform.
const HOST_READABLE: readonly DocumentType[] = [
  "PASSPORT_PHOTO",
  "ACCEPTANCE_LETTER",
  "PLACEMENT_LETTER",
  "SCHOOL_INTRO_LETTER",
  "ACTIVITY_EVIDENCE",
  "COMPLETION_LETTER",
  "COMPLETION_CERTIFICATE",
];

// Completion documents a host may issue; a school coordinator may issue the
// certificate and the intro letter.
const HOST_ISSUABLE: readonly DocumentType[] = ["COMPLETION_LETTER", "ACCEPTANCE_LETTER"];
const SCHOOL_ISSUABLE: readonly DocumentType[] = ["SCHOOL_INTRO_LETTER", "COMPLETION_CERTIFICATE"];

export function ownerOf(doc: Pick<Document, "studentId" | "schoolId" | "companyId" | "supervisorId">):
  | { type: OwnerType; id: string }
  | null {
  if (doc.studentId) return { type: "student", id: doc.studentId };
  if (doc.schoolId) return { type: "school", id: doc.schoolId };
  if (doc.companyId) return { type: "company", id: doc.companyId };
  if (doc.supervisorId) return { type: "supervisor", id: doc.supervisorId };
  return null;
}

export async function canReadDocument(actor: Actor, doc: Document): Promise<boolean> {
  if (isAdmin(actor) || doc.uploadedById === actor.id) return true;

  if (doc.studentId) {
    const rel = await studentRelation(actor, doc.studentId);
    if (rel === "self" || rel === "school") return true;
    return rel === "host" && HOST_READABLE.includes(doc.documentType);
  }
  if (doc.schoolId) {
    const rel = await schoolRelation(actor, doc.schoolId);
    return rel === "coordinator";
  }
  if (doc.companyId) {
    const rel = companyRelation(actor, doc.companyId);
    return rel === "owner";
  }
  if (doc.supervisorId) {
    const supervisor = await prisma.supervisor.findUnique({
      where: { id: doc.supervisorId },
      select: { id: true, companyId: true },
    });
    if (!supervisor) return false;
    const rel = supervisorRelation(actor, supervisor);
    return rel === "self" || rel === "company";
  }
  return false;
}

export type UploadDecision = { ok: true } | { ok: false; reason: string };

export async function canUploadDocument(
  actor: Actor,
  ownerType: OwnerType,
  ownerId: string,
  documentType: DocumentType
): Promise<UploadDecision> {
  if (!TYPES_BY_OWNER[ownerType].includes(documentType)) {
    return { ok: false, reason: `${documentType} cannot be attached to a ${ownerType}` };
  }
  if (isAdmin(actor)) return { ok: true };

  const deny = (reason: string): UploadDecision => ({ ok: false, reason });

  switch (ownerType) {
    case "student": {
      const rel = await studentRelation(actor, ownerId);
      if (rel === "self") {
        return ISSUED_TO_STUDENT.includes(documentType)
          ? deny(`${documentType} must be issued by your school or host organisation`)
          : { ok: true };
      }
      if (rel === "school" && SCHOOL_ISSUABLE.includes(documentType)) return { ok: true };
      if (rel === "host" && HOST_ISSUABLE.includes(documentType)) return { ok: true };
      return deny("You cannot upload this document for that student");
    }
    case "school": {
      const rel = await schoolRelation(actor, ownerId);
      return rel === "coordinator" ? { ok: true } : deny("You do not coordinate that school");
    }
    case "company": {
      const rel = companyRelation(actor, ownerId);
      return rel === "owner" ? { ok: true } : deny("You do not manage that company");
    }
    case "supervisor": {
      const supervisor = await prisma.supervisor.findUnique({
        where: { id: ownerId },
        select: { id: true, companyId: true },
      });
      if (!supervisor) return deny("Supervisor not found");
      const rel = supervisorRelation(actor, supervisor);
      return rel === "self" || rel === "company" ? { ok: true } : deny("Not your supervisor profile");
    }
  }
}

// Deleting is stricter than reading: a VERIFIED document is evidence and only
// an admin may remove it.
export async function canDeleteDocument(actor: Actor, doc: Document): Promise<boolean> {
  if (isAdmin(actor)) return true;
  if (doc.verificationStatus === "VERIFIED") return false;
  if (doc.uploadedById === actor.id) return true;

  const owner = ownerOf(doc);
  if (!owner) return false;
  switch (owner.type) {
    case "student":
      return (await studentRelation(actor, owner.id)) === "self";
    case "school":
      return (await schoolRelation(actor, owner.id)) === "coordinator";
    case "company":
      return companyRelation(actor, owner.id) === "owner";
    case "supervisor": {
      const supervisor = await prisma.supervisor.findUnique({
        where: { id: owner.id },
        select: { id: true, companyId: true },
      });
      if (!supervisor) return false;
      const rel = supervisorRelation(actor, supervisor);
      return rel === "self" || rel === "company";
    }
  }
}
