-- CreateTable
CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "fromStatus" "VerificationStatus",
    "toStatus" "VerificationStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationEvent_verificationId_idx" ON "VerificationEvent"("verificationId");

-- AddForeignKey
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "Verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
