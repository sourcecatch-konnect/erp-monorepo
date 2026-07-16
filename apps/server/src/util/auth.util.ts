import { JwtPayload } from "@skerp/types";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
};
export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};
export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
};
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as JwtPayload;
};
// Cross-site (e.g. ngrok demo where frontend and API are on different origins)
// requires SameSite=None + Secure. Toggle with COOKIE_CROSS_SITE=true in .env.
const crossSite = process.env.COOKIE_CROSS_SITE === "true";
const isProd = process.env.NODE_ENV === "production";

export const accessCookieOptions = {
  httpOnly: true,
  secure: crossSite || isProd,
  sameSite: (crossSite ? "none" : "strict") as "none" | "strict",
  maxAge: 15 * 60 * 1000,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: crossSite || isProd,
  sameSite: (crossSite ? "none" : "strict") as "none" | "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
export const ROLES = {
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
  SUPERVISOR: "SuperVisor",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
