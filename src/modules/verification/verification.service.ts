import type {
  Prisma,
  VerifiableEntityType,
  Verification,
  VerificationStatus,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/http-error.js";
import { skipTake, type Page } from "../../lib/pagination.js";
import { stripUndefined } from "../../lib/object.js";
import { isAdmin, loadActor, type Actor } from "../access/actor.js";
import { ENTITY_OWNER_FIELD, loadEntity, setEntityStatus, type EntitySnapshot } from "./entities.js";
import { canTransition, SUBMITTABLE } from "./state-machine.js";

type Tx = Prisma.TransactionClient;

// -- Who may do what ---------------------------------------------------------

// The owner puts their own profile forward. A supervisor submits for
// themselves, not their company admin, who reviews instead.
function canSubmit(actor: Actor, type: VerifiableEntityType, entityId: string, e: EntitySnapshot) {
  switch (type) {
    case "STUDENT":
      return actor.studentId === entityId;
    case "SCHOOL":
      return actor.coordinatedSchoolIds.includes(entityId);
    case "COMPANY":
      return actor.ownedCompanyId === entityId;
    case "SUPERVISOR":
      return actor.supervisorId === entityId && e.userId === actor.id;
  }
}

// Students are reviewed by their school coordinator, supervisors by their
// company admin; schools and companies only by the platform.
function canReview(actor: Actor, type: VerifiableEntityType, e: EntitySnapshot) {
  if (isAdmin(actor)) return true;
  switch (type) {
    case "STUDENT":
      return (
        actor.role === "SCHOOL_COORDINATOR" &&
        ((!!e.schoolId && actor.coordinatedSchoolIds.includes(e.schoolId)) || e.coordinatorId === actor.id)
      );
    case "SUPERVISOR":
      return actor.role === "COMPANY_ADMIN" && !!actor.ownedCompanyId && e.companyId === actor.ownedCompanyId;
    default:
      return false;
  }
}

// -- Writes ------------------------------------------------------------------

async function recordEvent(
  tx: Tx,
  verificationId: string,
  fromStatus: VerificationStatus | null,
  toStatus: VerificationStatus,
  actorId: string,
  note?: string | undefined
) {
  await tx.verificationEvent.create({
    data: { verificationId, fromStatus, toStatus, actorId, ...(note ? { note } : {}) },
  });
}

export async function submitForVerification(
  userId: string,
  input: { entityType: VerifiableEntityType; entityId: string; documentIds: string[]; notes?: string | undefined }
): Promise<Verification> {
  const actor = await loadActor(userId);
  const { entityType, entityId, notes } = input;
  const documentIds = [...new Set(input.documentIds)];

  return prisma.$transaction(async (tx) => {
    const entity = await loadEntity(tx, entityType, entityId);
    if (!entity) throw notFound(`${entityType.toLowerCase()} not found`);
    if (!canSubmit(actor, entityType, entityId, entity)) {
      throw forbidden("You cannot submit this profile for verification");
    }
    if (!SUBMITTABLE.includes(entity.verificationStatus)) {
      throw conflict(`Profile is already ${entity.verificationStatus}`);
    }

    // Evidence must be this entity's own documents.
    const ownerField = ENTITY_OWNER_FIELD[entityType];
    const docs = await tx.document.findMany({
      where: { id: { in: documentIds }, [ownerField]: entityId },
      select: { id: true },
    });
    if (docs.length !== documentIds.length) {
      throw badRequest("One or more documents do not exist or do not belong to this profile");
    }

    const changed = await setEntityStatus(tx, entityType, entityId, SUBMITTABLE, "SUBMITTED", null);
    if (changed !== 1) throw conflict("Profile status changed; try again");

    const verification = await tx.verification.create({
      data: { entityType, entityId, status: "SUBMITTED", ...(notes ? { notes } : {}) },
    });
    await tx.document.updateMany({
      where: { id: { in: documentIds } },
      data: { verificationId: verification.id, verificationStatus: "SUBMITTED" },
    });
    await recordEvent(tx, verification.id, null, "SUBMITTED", actor.id, notes);
    return verification;
  });
}

async function review(
  userId: string,
  verificationId: string,
  to: "UNDER_REVIEW" | "VERIFIED" | "REJECTED",
  opts: { rejectionReason?: string | undefined; notes?: string | undefined } = {}
): Promise<Verification> {
  const actor = await loadActor(userId);

  return prisma.$transaction(async (tx) => {
    const verification = await tx.verification.findUnique({ where: { id: verificationId } });
    if (!verification) throw notFound("Verification not found");

    const entity = await loadEntity(tx, verification.entityType, verification.entityId);
    if (!entity) throw notFound("The profile under review no longer exists");
    if (!canReview(actor, verification.entityType, entity)) {
      throw forbidden("You cannot review this verification");
    }
    // Nobody reviews their own submission, even as admin.
    if (entity.userId === actor.id) throw forbidden("You cannot review your own verification");

    const from = verification.status;
    if (!canTransition(from, to)) throw conflict(`Cannot move from ${from} to ${to}`);

    // Compare-and-set on the verification row so two reviewers cannot both win.
    const won = await tx.verification.updateMany({
      where: { id: verificationId, status: from },
      data: {
        status: to,
        reviewedById: actor.id,
        ...(to === "UNDER_REVIEW" ? {} : { reviewedAt: new Date() }),
        ...(to === "REJECTED" ? { rejectionReason: opts.rejectionReason ?? null } : {}),
        ...(opts.notes ? { notes: opts.notes } : {}),
      },
    });
    if (won.count !== 1) throw conflict("Verification was updated by someone else; reload and retry");

    const entityChanged = await setEntityStatus(
      tx,
      verification.entityType,
      verification.entityId,
      [from],
      to,
      actor.id
    );
    if (entityChanged !== 1) throw conflict("Profile status is out of sync with this verification");

    if (to !== "UNDER_REVIEW") {
      await tx.document.updateMany({
        where: { verificationId },
        data: {
          verificationStatus: to,
          verifiedById: to === "VERIFIED" ? actor.id : null,
          verifiedAt: to === "VERIFIED" ? new Date() : null,
        },
      });
    } else {
      await tx.document.updateMany({ where: { verificationId }, data: { verificationStatus: "UNDER_REVIEW" } });
    }

    await recordEvent(tx, verificationId, from, to, actor.id, opts.rejectionReason ?? opts.notes);
    return tx.verification.findUniqueOrThrow({ where: { id: verificationId } });
  });
}

export const startReview = (userId: string, id: string, notes?: string) =>
  review(userId, id, "UNDER_REVIEW", { notes });
export const approveVerification = (userId: string, id: string, notes?: string) =>
  review(userId, id, "VERIFIED", { notes });
export const rejectVerification = (userId: string, id: string, reason: string) =>
  review(userId, id, "REJECTED", { rejectionReason: reason });

// -- Reads -------------------------------------------------------------------

// The queue is limited to what this reviewer is allowed to act on.
async function reviewerScope(actor: Actor): Promise<Prisma.VerificationWhereInput> {
  if (isAdmin(actor)) return {};
  const clauses: Prisma.VerificationWhereInput[] = [];

  if (actor.role === "SCHOOL_COORDINATOR") {
    const students = await prisma.student.findMany({
      where: { OR: [{ schoolId: { in: actor.coordinatedSchoolIds } }, { coordinatorId: actor.id }] },
      select: { id: true },
    });
    clauses.push({ entityType: "STUDENT", entityId: { in: students.map((s) => s.id) } });
  }
  if (actor.role === "COMPANY_ADMIN" && actor.ownedCompanyId) {
    const supervisors = await prisma.supervisor.findMany({
      where: { companyId: actor.ownedCompanyId },
      select: { id: true },
    });
    clauses.push({ entityType: "SUPERVISOR", entityId: { in: supervisors.map((s) => s.id) } });
  }
  if (clauses.length === 0) throw forbidden("Your role cannot review verifications");
  return { OR: clauses };
}

export async function listQueue(
  userId: string,
  q: {
    page: number;
    pageSize: number;
    status?: VerificationStatus | undefined;
    entityType?: VerifiableEntityType | undefined;
  }
): Promise<Page<Verification>> {
  const actor = await loadActor(userId);
  const where: Prisma.VerificationWhereInput = {
    AND: [
      await reviewerScope(actor),
      // Default to work still waiting on a reviewer.
      q.status ? { status: q.status } : { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      stripUndefined({ entityType: q.entityType }),
    ],
  };
  const [data, total] = await Promise.all([
    prisma.verification.findMany({ where, orderBy: { submittedAt: "asc" }, ...skipTake(q.page, q.pageSize) }),
    prisma.verification.count({ where }),
  ]);
  return { data, page: q.page, pageSize: q.pageSize, total };
}

async function assertCanView(actor: Actor, v: Verification) {
  const entity = await loadEntity(prisma, v.entityType, v.entityId);
  if (!entity) return;
  if (canReview(actor, v.entityType, entity)) return;
  // Submitters can follow their own request.
  const isOwner =
    (v.entityType === "STUDENT" && actor.studentId === v.entityId) ||
    (v.entityType === "SCHOOL" && actor.coordinatedSchoolIds.includes(v.entityId)) ||
    (v.entityType === "COMPANY" && actor.ownedCompanyId === v.entityId) ||
    (v.entityType === "SUPERVISOR" && actor.supervisorId === v.entityId);
  if (!isOwner) throw notFound("Verification not found");
}

export async function getVerification(userId: string, id: string) {
  const actor = await loadActor(userId);
  const v = await prisma.verification.findUnique({
    where: { id },
    include: {
      documents: { select: { id: true, documentType: true, filename: true, verificationStatus: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!v) throw notFound("Verification not found");
  await assertCanView(actor, v);
  return v;
}

export async function listForEntity(userId: string, entityType: VerifiableEntityType, entityId: string) {
  const actor = await loadActor(userId);
  const latest = await prisma.verification.findFirst({
    where: { entityType, entityId },
    orderBy: { submittedAt: "desc" },
  });
  if (latest) await assertCanView(actor, latest);
  return prisma.verification.findMany({
    where: { entityType, entityId },
    orderBy: { submittedAt: "desc" },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
}
