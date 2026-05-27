import { z } from "zod";
import {
  branchSchema,
  createBranchSchema,
  updateBranchSchema,
} from "@skerp/validators";

export type Branch = z.infer<typeof branchSchema>;

export type CreateBranchBody = z.output<typeof createBranchSchema>;
export type UpdateBranchBody = z.output<typeof updateBranchSchema>;

export type CreateBranchFormInput = z.input<typeof createBranchSchema>;
export type UpdateBranchFormInput = z.input<typeof updateBranchSchema>;