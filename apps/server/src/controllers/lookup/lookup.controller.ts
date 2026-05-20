import { Request, Response } from "express";
import {
  listBranchesService,
  listCompaniesService,
} from "../../Services/lookup/lookup.services.js";

export const listCompaniesController = async (
  _req: Request,
  res: Response
) => {
  return res.json({
    success: true,
    data: await listCompaniesService(),
  });
};

export const listBranchesController = async (
  req: Request,
  res: Response
) => {
  const companyId =
    typeof req.query.companyId === "string"
      ? req.query.companyId
      : undefined;

  return res.json({
    success: true,
    data: await listBranchesService(companyId),
  });
};
