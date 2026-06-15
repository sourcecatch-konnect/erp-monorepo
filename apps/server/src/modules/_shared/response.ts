import { Response } from "express";
import { ApiError, ListMeta } from "@skerp/types";

const jsonSafe = <T>(value: T): T => {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === "bigint" ? val.toString() : val
    )
  );
};

export const sendOk = <T>(
  res: Response,
  data: T,
  meta?: ListMeta,
  status = 200
) => {
  return res.status(status).json(
    jsonSafe({
      ok: true,
      data,
      ...(meta ? { meta } : {}),
    })
  );
};

export const sendError = (
  res: Response,
  status: number,
  error: ApiError
) => {
  return res.status(status).json(
    jsonSafe({
      ok: false,
      error,
    })
  );
};