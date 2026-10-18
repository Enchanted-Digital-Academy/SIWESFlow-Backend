import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompanySchema } from "./company.schema.js";
import { createSchoolSchema } from "./school.schema.js";
import { createStudentSchema, updateStudentSchema } from "./student.schema.js";
import { completeSupervisorSchema, inviteSupervisorSchema } from "./supervisor.schema.js";

const student = {
  firstName: "Francess",
  lastName: "Okafor",
  dateOfBirth: "2001-04-12",
  gender: "FEMALE",
  phoneNumber: "+2348012345678",
  faculty: "Engineering",
  department: "Electrical/Electronic Engineering",
  programme: "BEng Electrical Engineering",
  level: "400",
  matriculationNumber: "ENG/2019/0456",
  academicSession: "2025/2026",
  siwesSession: "2026",
  schoolId: "sch_1",
};

test("accepts a valid student payload", () => {
  assert.equal(createStudentSchema.safeParse(student).success, true);
});

test("rejects system-managed fields", () => {
  for (const extra of [{ verificationStatus: "VERIFIED" }, { placementStatus: "PLACED" }, { supervisorId: "x" }, { email: "a@b.co" }]) {
    assert.equal(createStudentSchema.safeParse({ ...student, ...extra }).success, false);
  }
});

test("rejects bad values", () => {
  const bad = (patch: object) => createStudentSchema.safeParse({ ...student, ...patch }).success;
  assert.equal(bad({ level: "450" }), false);
  assert.equal(bad({ academicSession: "2025/2027" }), false);
  assert.equal(bad({ phoneNumber: "abc" }), false);
  assert.equal(bad({ dateOfBirth: "2030-01-01" }), false);
  assert.equal(bad({ siwesStartDate: "2026-06-01", siwesEndDate: "2026-01-01" }), false);
  assert.equal(bad({ passportPhotoUrl: "javascript:alert(1)" }), false);
});

test("updates must change something", () => {
  assert.equal(updateStudentSchema.safeParse({}).success, false);
  assert.equal(updateStudentSchema.safeParse({ level: "500" }).success, true);
});

test("school, company and supervisor payloads", () => {
  assert.equal(
    createSchoolSchema.safeParse({
      name: "Nile University", institutionType: "UNIVERSITY", address: "Abuja", state: "FCT", country: "Nigeria",
      email: "Info@Nile.edu.ng", phone: "+2348000000000",
    }).success,
    true
  );
  assert.equal(createSchoolSchema.safeParse({ name: "x", verificationStatus: "VERIFIED" }).success, false);
  assert.equal(
    createCompanySchema.safeParse({
      name: "Acme", industry: "Tech", address: "Lagos", state: "Lagos", country: "Nigeria",
      email: "hr@acme.com", phone: "+2348000000001", cacNumber: "RC123456",
    }).success,
    true
  );
  assert.equal(createCompanySchema.safeParse({ name: "Acme", cacNumber: "nope" }).success, false);
  const sup = { fullName: "A B", position: "Engineer", department: "IT", phone: "+2348000000002" };
  assert.equal(inviteSupervisorSchema.safeParse({ ...sup, email: "a@b.co" }).success, true);
  assert.equal(completeSupervisorSchema.safeParse({ ...sup, email: "a@b.co" }).success, false);
});
