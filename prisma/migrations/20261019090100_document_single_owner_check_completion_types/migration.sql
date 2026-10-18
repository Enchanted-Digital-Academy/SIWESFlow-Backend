-- A document belongs to exactly one owner (student, school, company or supervisor).
-- This fails if any existing row has zero or several owners; fix those rows first.
ALTER TABLE "Document" ADD CONSTRAINT "document_single_owner"
CHECK (num_nonnulls("studentId", "schoolId", "companyId", "supervisorId") = 1);

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'COMPLETION_LETTER';
ALTER TYPE "DocumentType" ADD VALUE 'COMPLETION_CERTIFICATE';
