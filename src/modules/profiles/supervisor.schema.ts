import { z } from "zod";
import { SupervisorActivationStatus } from "../../generated/prisma/client.js";
import { email, httpUrl, nonEmpty, paging, phone, text } from "./common.schema.js";

const profile = {
  fullName: text(160),
  position: text(120),
  department: text(120),
  phone,
  profileImageUrl: httpUrl.optional(),
  companyStaffId: text(60).optional(),
};

// A company admin invites a supervisor by email.
export const inviteSupervisorSchema = z.object({ ...profile, email }).strict();

// The invited supervisor fills in their own profile; email is fixed by the invite.
export const completeSupervisorSchema = z.object(profile).strict();

export const updateSupervisorSchema = nonEmpty(z.object(profile).partial().strict());

export const listSupervisorsQuery = paging.extend({
  companyId: z.string().max(64).optional(),
  activationStatus: z.enum(SupervisorActivationStatus).optional(),
});

export type InviteSupervisorInput = z.infer<typeof inviteSupervisorSchema>;
export type CompleteSupervisorInput = z.infer<typeof completeSupervisorSchema>;
export type UpdateSupervisorInput = z.infer<typeof updateSupervisorSchema>;
