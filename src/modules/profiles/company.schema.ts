import { z } from "zod";
import { VerificationStatus } from "../../generated/prisma/client.js";
import { email, httpUrl, nonEmpty, optionalText, paging, phone, text } from "./common.schema.js";

const base = {
  name: text(200),
  registrationName: text(200).optional(),
  industry: text(120),
  description: optionalText().optional(),
  address: text(300),
  state: text(80),
  country: text(80),
  website: httpUrl.optional(),
  email,
  phone,
  logoUrl: httpUrl.optional(),
  cacNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(RC|BN|IT)?[- ]?\d{4,8}$/, "Invalid CAC number")
    .optional(),
};

export const createCompanySchema = z.object(base).strict();
export const updateCompanySchema = nonEmpty(z.object(base).partial().strict());

export const listCompaniesQuery = paging.extend({
  industry: z.string().trim().max(120).optional(),
  state: z.string().trim().max(80).optional(),
  verificationStatus: z.enum(VerificationStatus).optional(),
  search: z.string().trim().max(100).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
