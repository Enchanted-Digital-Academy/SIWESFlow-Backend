import { z } from "zod";
import { InstitutionType, VerificationStatus } from "../../generated/prisma/client.js";
import { email, httpUrl, nonEmpty, optionalText, paging, phone, stringList, text } from "./common.schema.js";

const base = {
  name: text(200),
  institutionType: z.enum(InstitutionType),
  address: text(300),
  state: text(80),
  country: text(80),
  email,
  phone,
  website: httpUrl.optional(),
  logoUrl: httpUrl.optional(),
  coordinatorEmail: email.optional(),
  coordinatorPhone: phone.optional(),
  faculties: stringList().optional(),
  departments: stringList(300).optional(),
  programmes: stringList(300).optional(),
  levels: stringList(12).optional(),
  siwesRequirements: optionalText().optional(),
};

export const createSchoolSchema = z.object(base).strict();
export const updateSchoolSchema = nonEmpty(z.object(base).partial().strict());

export const listSchoolsQuery = paging.extend({
  state: z.string().trim().max(80).optional(),
  verificationStatus: z.enum(VerificationStatus).optional(),
  search: z.string().trim().max(100).optional(),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
