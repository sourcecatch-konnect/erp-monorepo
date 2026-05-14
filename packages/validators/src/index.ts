import { z } from "zod";

export const appKindSchema = z.enum(["admin", "employee"]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  app: appKindSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
