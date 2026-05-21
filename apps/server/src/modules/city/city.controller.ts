import { Request, Response } from "express";

import {
  createCitySchema,
  updateCitySchema,
} from "@skerp/validators";

import { ValidationError } from "../../lib/error.js";



import { getParamId } from "../_shared/param.js";
import { createCityService, deleteCityService, getCitiesService, getCityByIdService, updateCityService } from "./city.service.js";

export const createCityController = async (req: Request, res: Response) => {
  const parsed = createCitySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const city = await createCityService(parsed.data);

  return res.status(201).json({
    success: true,
    data: city,
  });
};

export const getCitiesController = async (_req: Request, res: Response) => {
  const cities = await getCitiesService();

  return res.json({
    success: true,
    data: cities,
  });
};

export const getCityByIdController = async (req: Request, res: Response) => {
  const city = await getCityByIdService(getParamId(req));

  return res.json({
    success: true,
    data: city,
  });
};

export const updateCityController = async (req: Request, res: Response) => {
  const parsed = updateCitySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten());
  }

  const city = await updateCityService(getParamId(req), parsed.data);

  return res.json({
    success: true,
    data: city,
  });
};

export const deleteCityController = async (req: Request, res: Response) => {
  await deleteCityService(getParamId(req));

  return res.json({
    success: true,
    message: "City deleted successfully",
  });
};