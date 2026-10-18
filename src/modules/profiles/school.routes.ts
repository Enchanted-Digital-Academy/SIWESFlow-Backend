import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../../middlewares/auth.js";
import { idParam } from "./common.schema.js";
import { createSchoolSchema, listSchoolsQuery, updateSchoolSchema } from "./school.schema.js";
import {
  createSchoolProfile,
  deleteSchoolProfile,
  getMySchools,
  getSchoolProfile,
  listSchools,
  updateSchoolProfile,
} from "./school.service.js";

export const schoolRouter = Router();
schoolRouter.use(requireAuth);

schoolRouter.post("/", requireRole("SCHOOL_COORDINATOR", "PLATFORM_ADMIN"), async (req, res) => {
  res.status(201).json(await createSchoolProfile(currentUser(req).id, createSchoolSchema.parse(req.body)));
});

schoolRouter.get("/me", requireRole("SCHOOL_COORDINATOR"), async (req, res) => {
  res.json(await getMySchools(currentUser(req).id));
});

schoolRouter.get("/", async (req, res) => {
  res.json(await listSchools(currentUser(req).id, listSchoolsQuery.parse(req.query)));
});

schoolRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await getSchoolProfile(currentUser(req).id, id));
});

schoolRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await updateSchoolProfile(currentUser(req).id, id, updateSchoolSchema.parse(req.body)));
});

schoolRouter.delete("/:id", requireRole("PLATFORM_ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  await deleteSchoolProfile(currentUser(req).id, id);
  res.status(204).send();
});
