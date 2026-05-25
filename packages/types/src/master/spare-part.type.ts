import {
  createSparePartSchema,
  updateSparePartSchema,
  sparePartSchema,
} from "@skerp/validators";
import z from "zod";

export type SparePart = z.infer<typeof sparePartSchema>;
export type CreateSparePartFormInput = z.input<typeof createSparePartSchema>;
export type CreateSparePartBody = z.output<typeof createSparePartSchema>;
export type UpdateSparePartFormInput = z.input<typeof updateSparePartSchema>;
export type UpdateSparePartBody = z.output<typeof updateSparePartSchema>;