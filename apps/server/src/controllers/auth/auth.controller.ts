import { Request, Response } from "express";
import { forgotPasswordSchema, resetPasswordSchema } from "@skerp/validators";
import {
  adminLoginService,
  employeeLoginService,
  getMeService,
  webLoginService,
} from "../../Services/auth/auth.services.js";
import {
  requestPasswordResetService,
  resetPasswordService,
} from "../../Services/auth/password-reset.services.js";
import { ValidationError } from "../../lib/error.js";
import {
  accessCookieOptions,
  generateAccessToken,
  refreshCookieOptions,
  verifyRefreshToken,
} from "../../util/auth.util.js";

const setSessionCookies = (
  res: Response,
  result: { accessToken: string; refreshToken: string },
) => {
  res.cookie("accessToken", result.accessToken, accessCookieOptions);
  res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);
};

export const webLoginController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await webLoginService(email, password);

  setSessionCookies(res, result);

  return res.json({
    success: true,
    data: result.user,
  });
};

export const adminLoginController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await adminLoginService(email, password);

  setSessionCookies(res, result);

  return res.json({
    success: true,
    data: result.user,
  });
};

export const employeeLoginController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await employeeLoginService(email, password);

  setSessionCookies(res, result);

  return res.json({
    success: true,
    data: result.user,
  });
};

export const forgotPasswordController = async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  await requestPasswordResetService(parsed.data.email);

  // Same response whether or not the address is registered.
  return res.json({
    success: true,
    message: "If that email is registered, a password reset link has been sent.",
  });
};

export const resetPasswordController = async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  await resetPasswordService(parsed.data.token, parsed.data.password);

  return res.json({
    success: true,
    message: "Your password has been reset. You can now sign in.",
  });
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.json({
    success: true,
    message: "Logged out successfully",
  });
};

export const refreshTokenController = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token",
      });
    }

    const payload = verifyRefreshToken(refreshToken);

    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      appKind: payload.appKind,
      role: payload.role,
    });

    res.cookie("accessToken", newAccessToken, accessCookieOptions);

    return res.json({
      success: true,
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

export const meController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await getMeService(req.user.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    return res.json({
      success: true,
      data: {
        ...user,
        permissions: req.ctx ? Array.from(req.ctx.permissions) : [],
        branchScope: req.ctx?.branchScope ?? "ASSIGNED",
        branchIds: req.ctx?.branchIds ?? [],
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to load user",
    });
  }
};
