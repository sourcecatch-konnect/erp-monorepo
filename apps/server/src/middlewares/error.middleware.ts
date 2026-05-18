import { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/error.js";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Known App Errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      details: err.details ?? null,
      ...(process.env.NODE_ENV !== "production" && {
        stack: err.stack,
      }),
    });
  }

  // Unknown Errors
  console.error("UNHANDLED ERROR:", err);

  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message || "Internal Server Error",
    code: "INTERNAL_SERVER_ERROR",
    details: null,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
    }),
  });
};