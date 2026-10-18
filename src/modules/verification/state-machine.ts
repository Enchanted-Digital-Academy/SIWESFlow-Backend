import type { VerificationStatus } from "../../generated/prisma/client.js";

// UNVERIFIED -> SUBMITTED ("pending") -> UNDER_REVIEW -> VERIFIED | REJECTED,
// and a rejected entity may resubmit.
export const TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  UNVERIFIED: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["VERIFIED", "REJECTED"],
  VERIFIED: [],
  REJECTED: ["SUBMITTED"],
};

export const canTransition = (from: VerificationStatus, to: VerificationStatus) =>
  TRANSITIONS[from].includes(to);

// Statuses in which an entity can be put forward for (re)verification.
export const SUBMITTABLE: readonly VerificationStatus[] = ["UNVERIFIED", "REJECTED"];
