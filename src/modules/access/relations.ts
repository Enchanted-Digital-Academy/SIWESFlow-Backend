import { prisma } from "../../lib/prisma.js";
import { isAdmin, type Actor } from "./actor.js";

// How the actor relates to an entity. Policy code switches on this instead
// of re-deriving ownership in every route.

export type StudentRelation = "admin" | "self" | "school" | "host" | null;
export type SchoolRelation = "admin" | "coordinator" | "member" | null;
export type CompanyRelation = "admin" | "owner" | "staff" | null;
export type SupervisorRelation = "admin" | "self" | "company" | "supervisee" | null;

export async function studentRelation(actor: Actor, studentId: string): Promise<StudentRelation> {
  if (isAdmin(actor)) return "admin";
  if (actor.studentId === studentId) return "self";

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      schoolId: true,
      coordinatorId: true,
      supervisorId: true,
      placement: { select: { companyId: true } },
    },
  });
  if (!student) return null;

  if (
    actor.role === "SCHOOL_COORDINATOR" &&
    (student.coordinatorId === actor.id || actor.coordinatedSchoolIds.includes(student.schoolId))
  ) {
    return "school";
  }
  if (actor.supervisorId && student.supervisorId === actor.supervisorId) return "host";
  if (
    actor.role === "COMPANY_ADMIN" &&
    actor.ownedCompanyId &&
    student.placement?.companyId === actor.ownedCompanyId
  ) {
    return "host";
  }
  return null;
}

export async function schoolRelation(actor: Actor, schoolId: string): Promise<SchoolRelation> {
  if (isAdmin(actor)) return "admin";
  if (actor.role === "SCHOOL_COORDINATOR" && actor.coordinatedSchoolIds.includes(schoolId)) {
    return "coordinator";
  }
  if (actor.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: actor.studentId },
      select: { schoolId: true },
    });
    if (student?.schoolId === schoolId) return "member";
  }
  return null;
}

export function companyRelation(actor: Actor, companyId: string): CompanyRelation {
  if (isAdmin(actor)) return "admin";
  if (actor.ownedCompanyId === companyId) return "owner";
  if (actor.supervisorCompanyId === companyId) return "staff";
  return null;
}

export function supervisorRelation(
  actor: Actor,
  supervisor: { id: string; companyId: string }
): SupervisorRelation {
  if (isAdmin(actor)) return "admin";
  if (actor.supervisorId === supervisor.id) return "self";
  if (actor.ownedCompanyId === supervisor.companyId) return "company";
  return null;
}

export async function isSupervisedBy(actor: Actor, supervisorId: string): Promise<boolean> {
  if (!actor.studentId) return false;
  const student = await prisma.student.findUnique({
    where: { id: actor.studentId },
    select: { supervisorId: true },
  });
  return student?.supervisorId === supervisorId;
}
