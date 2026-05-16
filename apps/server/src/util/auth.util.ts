
import { JwtPayload } from "@skerp/types";
import { Response } from "express";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
export const generateAccessToken = (
  payload: JwtPayload
): string => {
  return jwt.sign(
    payload,
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: "20s", // temporarily
    }
  );
};
export const generateRefreshToken = (
  payload: JwtPayload
): string => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};
export const verifyAccessToken = (
  token: string
): JwtPayload => {
  return jwt.verify(
    token,
    ACCESS_TOKEN_SECRET
  ) as JwtPayload;
};
export const verifyRefreshToken = (
  token: string
): JwtPayload => {
  return jwt.verify(
    token,
    REFRESH_TOKEN_SECRET
  ) as JwtPayload;
};
export const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 15 * 60 * 1000,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
export const ROLES = {
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];