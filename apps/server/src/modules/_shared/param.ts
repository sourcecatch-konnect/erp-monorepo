import { Request } from "express";
import { ValidationError } from "../../lib/error.js";

export const getParamId = (req: Request): string => {
  const id = req.params.id;

  if (!id || Array.isArray(id)) {
    throw new ValidationError("Invalid ID");
  }

  return id;
};