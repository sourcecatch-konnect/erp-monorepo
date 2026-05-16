import { z } from "zod";

export const appKindSchema = z.enum(["admin", "employee"]);

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format"),

  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
  appKind: appKindSchema
});

export type LoginInput = z.infer<typeof loginSchema>;
