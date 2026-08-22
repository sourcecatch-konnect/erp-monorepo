import { z } from "zod";
import {
  branchSchema,
  createBranchSchema,
  updateBranchSchema,
  branchRailheadAreaSchema,
  updateBranchRailheadsSchema,
} from "@skerp/validators";

export type Branch = z.infer<typeof branchSchema>;

export type CreateBranchBody = z.output<typeof createBranchSchema>;
export type UpdateBranchBody = z.output<typeof updateBranchSchema>;

export type CreateBranchFormInput = z.input<typeof createBranchSchema>;
export type UpdateBranchFormInput = z.input<typeof updateBranchSchema>;
export type BranchRailheadArea = z.infer<typeof branchRailheadAreaSchema>;
export type UpdateBranchRailheadsBody = z.infer<
  typeof updateBranchRailheadsSchema
>;
