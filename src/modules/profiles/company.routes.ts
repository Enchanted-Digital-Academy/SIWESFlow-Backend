import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../../middlewares/auth.js";
import { idParam } from "./common.schema.js";
import { createCompanySchema, listCompaniesQuery, updateCompanySchema } from "./company.schema.js";
import {
  createCompanyProfile,
  deleteCompanyProfile,
  getCompanyProfile,
  getMyCompany,
  listCompanies,
  updateCompanyProfile,
} from "./company.service.js";

export const companyRouter = Router();
companyRouter.use(requireAuth);

companyRouter.post("/", requireRole("COMPANY_ADMIN"), async (req, res) => {
  res.status(201).json(await createCompanyProfile(currentUser(req).id, createCompanySchema.parse(req.body)));
});

companyRouter.get("/me", requireRole("COMPANY_ADMIN"), async (req, res) => {
  res.json(await getMyCompany(currentUser(req).id));
});

companyRouter.get("/", async (req, res) => {
  res.json(await listCompanies(currentUser(req).id, listCompaniesQuery.parse(req.query)));
});

companyRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await getCompanyProfile(currentUser(req).id, id));
});

companyRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json(await updateCompanyProfile(currentUser(req).id, id, updateCompanySchema.parse(req.body)));
});

companyRouter.delete("/:id", requireRole("PLATFORM_ADMIN"), async (req, res) => {
  const { id } = idParam.parse(req.params);
  await deleteCompanyProfile(currentUser(req).id, id);
  res.status(204).send();
});
