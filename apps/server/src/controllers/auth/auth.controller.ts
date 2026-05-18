import { Request, Response } from "express";
import { adminLoginService, employeeLoginService } from "../../Services/auth/auth.services.js";
import { accessCookieOptions, generateAccessToken, refreshCookieOptions, verifyRefreshToken } from "../../util/auth.util.js";

export const adminLoginController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await adminLoginService(email, password);

  res.cookie("accessToken", result.accessToken, accessCookieOptions);
  res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

  return res.json({
    success: true,
    data: result.user,
  });
};

export const employeeLoginController = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await employeeLoginService(email, password);

  res.cookie("accessToken", result.accessToken, accessCookieOptions);
  res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

  return res.json({
    success: true,
    data: result.user,
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

export const refreshTokenController = async (
  req: Request,
  res: Response
) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token"
      });
    }

    const payload = verifyRefreshToken(
      refreshToken
    );

    const newAccessToken =
      generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        appKind: payload.appKind,
        role: payload.role
      });

    res.cookie(
      "accessToken",
      newAccessToken,
      accessCookieOptions
    );

    return res.json({
      success: true
    });

  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token"
    });
  }
};