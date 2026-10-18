import type {
  Prisma,
  VerifiableEntityType,
  VerificationStatus,
} from "../../generated/prisma/client.js";

type Tx = Prisma.TransactionClient;

export const ENTITY_OWNER_FIELD = {
  STUDENT: "studentId",
  SCHOOL: "schoolId",
  COMPANY: "companyId",
  SUPERVISOR: "supervisorId",
} as const satisfies Record<VerifiableEntityType, string>;

export interface EntitySnapshot {
  verificationStatus: VerificationStatus;
  // Used to decide who may submit or review.
  schoolId?: string;
  companyId?: string;
  userId?: string | null;
  coordinatorId?: string | null;
}

export async function loadEntity(
  tx: Tx,
  type: VerifiableEntityType,
  id: string
): Promise<EntitySnapshot | null> {
  switch (type) {
    case "STUDENT": {
      const s = await tx.student.findUnique({
        where: { id },
        select: { verificationStatus: true, schoolId: true, userId: true, coordinatorId: true },
      });
      return s;
    }
    case "SCHOOL": {
      const s = await tx.school.findUnique({
        where: { id },
        select: { verificationStatus: true, coordinatorId: true },
      });
      return s;
    }
    case "COMPANY": {
      const c = await tx.company.findUnique({
        where: { id },
        select: { verificationStatus: true, ownerUserId: true },
      });
      return c && { verificationStatus: c.verificationStatus, userId: c.ownerUserId };
    }
    case "SUPERVISOR": {
      const s = await tx.supervisor.findUnique({
        where: { id },
        select: { verificationStatus: true, companyId: true, userId: true },
      });
      return s;
    }
  }
}

// Compare-and-set on the entity's status. Returns how many rows changed (0 or
// 1), so a concurrent transition loses instead of overwriting.
export async function setEntityStatus(
  tx: Tx,
  type: VerifiableEntityType,
  id: string,
  from: readonly VerificationStatus[],
  to: VerificationStatus,
  reviewerId: string | null
): Promise<number> {
  const verified = to === "VERIFIED";
  const data = {
    verificationStatus: to,
    verifiedById: verified ? reviewerId : null,
    verifiedAt: verified ? new Date() : null,
  };
  const where = { id, verificationStatus: { in: [...from] } };

  switch (type) {
    case "STUDENT":
      return (await tx.student.updateMany({ where, data })).count;
    case "SCHOOL":
      return (await tx.school.updateMany({ where, data })).count;
    case "COMPANY":
      return (await tx.company.updateMany({ where, data })).count;
    case "SUPERVISOR":
      return (await tx.supervisor.updateMany({ where, data })).count;
  }
}
