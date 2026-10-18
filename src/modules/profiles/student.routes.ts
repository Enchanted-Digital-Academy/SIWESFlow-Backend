import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../../middlewares/auth.js";
import { idParam } from "./common.schema.js";
import {
  createStudentSchema,
  listStudentsQuery,
  updateStudentSchema,
} from "./student.schema.js";
import {
  createStudentProfile,
  deleteStudentProfile,
  getMyStudentProfile,
  getStudentProfile,
  listStudents,
  updateStudentProfile,
} from "./student.service.js";

export const studentRouter = Router();
studentRouter.use(requireAuth);

studentRouter.post("/", requireRole("STUDENT"), async (req, res) => {
  const body = createStudentSchema.parse(req.body);
  res.status(201).json(await createStudentProfile(currentUser(req).id, body));
});

studentRouter.get("/me", requireRole("STUDENT"), async (req, res) => {
  res.json(await getMyStudentProfile(currentUser(req).id));
});

studentRouter.get("/", async (req, res) => {
  res.json(await listStudents(currentUser(req).id, listStudentsQuery.parse(req.query)));
});

studentRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await getStudentProfile(currentUser(req).id, id));
});

studentRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await updateStudentProfile(currentUser(req).id, id, updateStudentSchema.parse(req.body)));
});

studentRouter.delete("/:id", requireRole("PLATFORM_ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  await deleteStudentProfile(currentUser(req).id, id);
  res.status(204).send();
});
