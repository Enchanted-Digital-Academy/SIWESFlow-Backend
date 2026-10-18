// Usage: npm run audit:documents
// Prints the document integrity report as JSON; exits 1 if any issue is found.
import "dotenv/config";

const { auditDocumentIntegrity } = await import("../services/document-integrity.service.js");
const { prisma } = await import("../lib/prisma.js");

try {
  const report = await auditDocumentIntegrity();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.issueCount === 0 ? 0 : 1;
} finally {
  await prisma.$disconnect();
}
