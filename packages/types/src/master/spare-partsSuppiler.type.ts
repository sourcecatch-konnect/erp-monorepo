import {
  sparePartSupplierSchema,
  createSparePartSupplierSchema,
  updateSparePartSupplierSchema,
} from "@skerp/validators";
import z from "zod";

export type SparePartSupplier = z.infer<typeof sparePartSupplierSchema>;

export type CreateSparePartSupplierFormInput = z.input<
  typeof createSparePartSupplierSchema
>;

export type CreateSparePartSupplierBody = z.output<
  typeof createSparePartSupplierSchema
>;

export type UpdateSparePartSupplierFormInput = z.input<
  typeof updateSparePartSupplierSchema
>;

export type UpdateSparePartSupplierBody = z.output<
  typeof updateSparePartSupplierSchema
>;