import { Router } from "express";
import { z } from "zod";
import { currentUser, requireAuth, requireRole } from "../../middlewares/auth.js";
import { idParam } from "./common.schema.js";
import {
  completeSupervisorSchema,
  inviteSupervisorSchema,
  listSupervisorsQuery,
  updateSupervisorSchema,
} from "./supervisor.schema.js";
import {
  completeMySupervisorProfile,
  confirmSupervisor,
  deleteSupervisorProfile,
  getMySupervisorProfile,
  getSupervisorProfile,
  inviteSupervisor,
  listSupervisors,
  suspendSupervisor,
  updateSupervisorProfile,
} from "./supervisor.service.js";

export const supervisorRouter = Router();
supervisorRouter.use(requireAuth);

// Platform admins must say which company they are inviting for.
const inviteBody = inviteSupervisorSchema.extend({ companyId: z.string().min(1).max(64).optional() });

supervisorRouter.post("/", requireRole("COMPANY_ADMIN", "PLATFORM_ADMIN"), async (req, res) => {
  const body = inviteBody.parse(req.body);
  const { companyId, ...fields } = body;
  res.status(201).json(
    await inviteSupervisor(currentUser(req).id, { ...fields, ...(companyId ? { companyId } : {}) })
  );
});

supervisorRouter.put("/me", requireRole("SUPERVISOR"), async (req, res) => {
  res.json(await completeMySupervisorProfile(currentUser(req).id, completeSupervisorSchema.parse(req.body)));
});

supervisorRouter.get("/me", requireRole("SUPERVISOR"), async (req, res) => {
  res.json(await getMySupervisorProfile(currentUser(req).id));
});

supervisorRouter.get("/", async (req, res) => {
  res.json(await listSupervisors(currentUser(req).id, listSupervisorsQuery.parse(req.query)));
});

supervisorRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await getSupervisorProfile(currentUser(req).id, id));
});

supervisorRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await updateSupervisorProfile(currentUser(req).id, id, updateSupervisorSchema.parse(req.body)));
});

supervisorRouter.post("/:id/confirm", requireRole("COMPANY_ADMIN", "PLATFORM_ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await confirmSupervisor(currentUser(req).id, id));
});

supervisorRouter.post("/:id/suspend", requireRole("COMPANY_ADMIN", "PLATFORM_ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await suspendSupervisor(currentUser(req).id, id));
});

supervisorRouter.delete("/:id", requireRole("COMPANY_ADMIN", "PLATFORM_ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  await deleteSupervisorProfile(currentUser(req).id, id);
  res.status(204).send();
});
