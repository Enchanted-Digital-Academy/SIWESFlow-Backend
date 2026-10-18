-- CreateEnum
CREATE TYPE "PlacementApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex: a placement now holds many students (1:N), so Student.placementId is no longer unique
DROP INDEX "Student_placementId_key";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "ownerUserId" TEXT;

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvalStatus" "PlacementApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_ownerUserId_key" ON "Company"("ownerUserId");

-- CreateIndex
CREATE INDEX "Placement_approvalStatus_idx" ON "Placement"("approvalStatus");

-- CreateIndex
CREATE INDEX "Student_placementId_idx" ON "Student"("placementId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
