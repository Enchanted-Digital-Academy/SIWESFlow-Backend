// src/app.ts
// Owns all middleware and routes. Doesn't read process.env at the top
// level, so it's safe to import before dotenv has loaded — but anything
// it imports (document.routes.ts → document.service.ts → supabase.ts)
// DOES read env vars at load time, so dotenv still has to run first in
// whichever file imports this one (server.ts).

import express from "express";
import { prisma } from "./lib/prisma.js";
import { documentRouter } from "./routes/document.routes.js";

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

export default app;