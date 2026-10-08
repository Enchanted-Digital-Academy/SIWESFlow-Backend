import type { NextFunction, Request, Response } from "express";

function statusOf(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err && typeof err.status === "number") {
    return err.status; // body-parser errors: 400 bad JSON, 413 payload too large
  }
  return 500;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = statusOf(err);
  // Replace with a structured logger (e.g. pino) before production. Never log req.body: it contains passwords.
  console.error({ method: req.method, path: req.path, status, err });
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : "Invalid request",
  });
}