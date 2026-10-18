import { z } from "zod";
import { VerifiableEntityType, VerificationStatus } from "../../generated/prisma/client.js";
import { optionalText, paging } from "../profiles/common.schema.js";

export const submitVerificationSchema = z
  .object({
    entityType: z.enum(VerifiableEntityType),
    entityId: z.string().min(1).max(64),
    documentIds: z.array(z.string().min(1).max(64)).min(1, "Attach at least one document").max(10),
    notes: optionalText(1000).optional(),
  })
  .strict();

export const rejectVerificationSchema = z
  .object({ reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(1000) })
  .strict();

export const reviewNoteSchema = z.object({ notes: optionalText(1000).optional() }).strict();

export const queueQuery = paging.extend({
  status: z.enum(VerificationStatus).optional(),
  entityType: z.enum(VerifiableEntityType).optional(),
});

export const entityParams = z.object({
  entityType: z.enum(VerifiableEntityType),
  entityId: z.string().min(1).max(64),
});
