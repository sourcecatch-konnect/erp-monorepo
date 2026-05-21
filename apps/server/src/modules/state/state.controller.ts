import { Request, Response } from "express";

import {
  createStateSchema,
  updateStateSchema,
} from "@skerp/validators";

import { ValidationError } from "../../lib/error.js";

import {
  createStateService,
  getStatesService,
  getStateByIdService,
  updateStateService,
  deleteStateService,
} from "./state.service.js";
import { getParamId } from "../_shared/param.js";

export const createStateController = async (
  req: Request,
  res: Response
) => {
  const parsed =
    createStateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.flatten()
    );
  }

  const state = await createStateService(
    parsed.data
  );

  return res.status(201).json({
    success: true,
    data: state,
  });
};

export const getStatesController = async (
  _req: Request,
  res: Response
) => {
  const states =
    await getStatesService();

  return res.json({
    success: true,
    data: states,
  });
};

export const getStateByIdController = async (
  req: Request,
  res: Response
) => {
  const state = await getStateByIdService(getParamId(req));

  return res.json({
    success: true,
    data: state,
  });
};

export const updateStateController = async (
  req: Request,
  res: Response
) => {
  const parsed =
    updateStateSchema.safeParse(
      req.body
    );

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.flatten()
    );
  }

 const state = await updateStateService(
  getParamId(req),
  parsed.data
);

  return res.json({
    success: true,
    data: state,
  });
};

export const deleteStateController = async (
  req: Request,
  res: Response
) => {
await deleteStateService(getParamId(req));

  return res.json({
    success: true,
    message:
      "State deleted successfully",
  });
};