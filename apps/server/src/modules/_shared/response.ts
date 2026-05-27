import { Response } from "express";
import { ApiError, ListMeta } from "@skerp/types";

export const sendOk = <T>(
  res: Response,
  data: T,
  meta?: ListMeta,
  status = 200
) => {
  return res.status(status).json({
    ok: true,
    data,
    ...(meta ? { meta } : {}),
  });
};

export const sendError = (
  res: Response,
  status: number,
  error: ApiError
) => {
  return res.status(status).json({
    ok: false,
    error,
  });
};
