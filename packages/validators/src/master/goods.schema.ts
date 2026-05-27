import { z } from "zod";

/* -----------------------------
   GOODS SCHEMA
------------------------------ */

export const GoodsCategoryEnum = z.enum(["Heavy", "Light"]);
export const GoodsStoragePositionEnum = z.enum(["Any", "Horizontal", "Vertical"]);
export const GoodsStorageLayerEnum = z.enum(["Both", "Bottom", "Upper"]);
export const goodsSchema = z.object({
  id: z.string(),

  name: z.string(),
  description: z.string().optional(),

  weight: z.coerce.number().positive().optional(),
length: z.coerce.number().positive().optional(),
width: z.coerce.number().positive().optional(),
height: z.coerce.number().positive().optional(),

  category: GoodsCategoryEnum,
  storagePosition: GoodsStoragePositionEnum,
  storageLayer: GoodsStorageLayerEnum,

  isStackingAllowed: z.boolean(),

  lorryReceiptId: z.string().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

/* -----------------------------
   CREATE GOODS
------------------------------ */

export const createGoodsSchema = z.object({
  name: z.string().trim().min(1).max(100),

  description: z.string().max(500).optional(),

weight: z.coerce.number().positive().optional(),
length: z.coerce.number().positive().optional(),
width: z.coerce.number().positive().optional(),
height: z.coerce.number().positive().optional(),

  category: GoodsCategoryEnum,
  storagePosition: GoodsStoragePositionEnum,
  storageLayer: GoodsStorageLayerEnum,

  isStackingAllowed: z.boolean().default(false),

  lorryReceiptId: z.preprocess(
  (v) => v === "" ? undefined : v,
  z.string().optional()
)
});

/* -----------------------------
   UPDATE GOODS
------------------------------ */

export const updateGoodsSchema = createGoodsSchema.partial();

export type Goods = z.infer<typeof goodsSchema>;
export type CreateGoodsBody = z.infer<typeof createGoodsSchema>;
export type UpdateGoodsBody = z.infer<typeof updateGoodsSchema>;