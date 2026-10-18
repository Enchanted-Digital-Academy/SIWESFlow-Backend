// src/app.ts
// Owns all middleware and routes. Doesn't read process.env at the top
// level, so it's safe to import before dotenv has loaded — but anything
// it imports (document.routes.ts → document.service.ts → supabase.ts)
// DOES read env vars at load time, so dotenv still has to run first in
// whichever file imports this one (server.ts).

import express from "express";
import { prisma } from "./lib/prisma.js";
import { documentRouter } from "./routes/document.routes.js";
import { studentRouter } from "./modules/profiles/student.routes.js";
import { schoolRouter } from "./modules/profiles/school.routes.js";
import { companyRouter } from "./modules/profiles/company.routes.js";
import { supervisorRouter } from "./modules/profiles/supervisor.routes.js";
import { verificationRouter } from "./modules/verification/verification.routes.js";
import { integrityRouter } from "./modules/admin/integrity.routes.js";
import { httpErrorHandler } from "./middlewares/http-error-handler.js";

const app = express();

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.use("/auth", (_req, res) => {
  res.status(501).json({ message: "Auth routes not yet implemented" });
});

app.use("/documents", documentRouter);

app.use("/api/students", studentRouter);
app.use("/api/schools", schoolRouter);
app.use("/api/companies", companyRouter);
app.use("/api/supervisors", supervisorRouter);
app.use("/api/verifications", verificationRouter);
app.use("/api/admin/integrity", integrityRouter);

// Must come after the routers: turns HttpError / ZodError into JSON responses.
app.use(httpErrorHandler);

// Anything that reaches here was not an expected error.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Internal server error" : "Invalid request" });
});

export default app;