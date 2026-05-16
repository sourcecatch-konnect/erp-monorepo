import { Router, type Router as ExpressRouter } from "express";
import { loginSchema } from "@skerp/validators";

export const authRouter: ExpressRouter = Router();

authRouter.post("/login", (req, res) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Invalid login payload",
      errors: result.error.flatten(),
    });
  }

  return res.status(501).json({
    message: "Auth implementation pending",
    data: {
      app: result.data.app,
    },
  });
});

authRouter.get("/profile", (_req, res) => {
  res.status(501).json({
    message: "Profile implementation pending",
  });
});
