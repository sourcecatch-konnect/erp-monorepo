import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/error.js";
import { sendError } from "../modules/_shared/response.js";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Known App Errors
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, {
      code: err.code,
      message: err.message,
      details: err.details ?? null,
      ...(process.env.NODE_ENV !== "production" && {
        stack: err.stack,
      }),
    });
  }

  // Unknown Errors
  console.error("UNHANDLED ERROR:", err);

  return sendError(res, 500, {
    code: "INTERNAL_SERVER_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message || "Internal Server Error",
    details: null,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
    }),
  });
};
