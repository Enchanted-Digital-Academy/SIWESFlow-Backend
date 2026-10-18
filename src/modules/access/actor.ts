import type { UserRole } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { unauthorized } from "../../lib/http-error.js";

// Everything an access decision needs to know about the caller, loaded once.
export interface Actor {
  id: string;
  role: UserRole;
  email: string;
  studentId: string | null;
  supervisorId: string | null;
  supervisorCompanyId: string | null;
  ownedCompanyId: string | null;
  coordinatedSchoolIds: string[];
}

export async function loadActor(userId: string): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      student: { select: { id: true } },
      supervisorProfile: { select: { id: true, companyId: true } },
      companyOwned: { select: { id: true } },
      schoolsCoordinated: { select: { id: true } },
    },
  });
  if (!user) throw unauthorized();

  return {
    id: user.id,
    role: user.role,
    email: user.email,
    studentId: user.student?.id ?? null,
    supervisorId: user.supervisorProfile?.id ?? null,
    supervisorCompanyId: user.supervisorProfile?.companyId ?? null,
    ownedCompanyId: user.companyOwned?.id ?? null,
    coordinatedSchoolIds: user.schoolsCoordinated.map((s) => s.id),
  };
}

export const isAdmin = (actor: Actor) => actor.role === "PLATFORM_ADMIN";
