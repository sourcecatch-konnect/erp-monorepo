import { z } from "zod";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  warehouseSchema,
} from "@skerp/validators";
/* ---------------------------------
   BASE ENTITY TYPE (DB / API)
---------------------------------- */
export type Warehouse = z.infer<typeof warehouseSchema>;
export type WarehouseWithRelations = Warehouse & {
  branch?: {
    id: string;
    name: string;
  };

  city?: {
    id: string;
    name: string;
  };

  state?: {
    id: string;
    name: string;
  };
};
/* ---------------------------------
   API REQUEST TYPES (POST / PUT)
---------------------------------- */
export type CreateWarehouseBody = z.output<typeof createWarehouseSchema>;
export type UpdateWarehouseBody = z.output<typeof updateWarehouseSchema>;

/* ---------------------------------
   FORM INPUT TYPES (FRONTEND)
   (before transformation)
---------------------------------- */
export type CreateWarehouseFormInput = z.input<typeof createWarehouseSchema>;
export type UpdateWarehouseFormInput = z.input<typeof updateWarehouseSchema>;