// Usage: npm run backup:check
// Pre-backup / post-restore sanity check. Confirms the database and the storage
// bucket are reachable, records row counts to compare against a restore, and
// runs the document integrity audit. Exits 1 if anything is wrong.
import "dotenv/config";

const { prisma } = await import("../lib/prisma.js");
const { auditDocumentIntegrity } = await import("../services/document-integrity.service.js");

const problems: string[] = [];

try {
  await prisma.$queryRaw`SELECT 1`;

  const [users, students, schools, companies, supervisors, placements, applications, activities, documents, verifications, events] =
    await Promise.all([
      prisma.user.count(),
      prisma.student.count(),
      prisma.school.count(),
      prisma.company.count(),
      prisma.supervisor.count(),
      prisma.placement.count(),
      prisma.application.count(),
      prisma.activity.count(),
      prisma.document.count(),
      prisma.verification.count(),
      prisma.verificationEvent.count(),
    ]);
  const counts = { users, students, schools, companies, supervisors, placements, applications, activities, documents, verifications, verificationEvents: events };

  const migrations = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
    SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at`;
  const unfinished = migrations.filter((m) => !m.finished_at).map((m) => m.migration_name);
  if (unfinished.length) problems.push(`Unfinished migrations: ${unfinished.join(", ")}`);

  const integrity = await auditDocumentIntegrity();
  if (integrity.issueCount) problems.push(`${integrity.issueCount} document integrity issue(s); run npm run audit:documents`);

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    counts,
    appliedMigrations: migrations.length,
    storageObjects: integrity.storageObjects,
    documentsChecked: integrity.documentsChecked,
    problems,
  }, null, 2));
} catch (err) {
  problems.push(err instanceof Error ? err.message : String(err));
  console.error(problems);
} finally {
  await prisma.$disconnect();
}
process.exitCode = problems.length ? 1 : 0;
