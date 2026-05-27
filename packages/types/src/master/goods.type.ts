import { z } from "zod";

import {
  goodsSchema,
  createGoodsSchema,
  updateGoodsSchema,
} from "@skerp/validators";

export type Goods = z.infer<typeof goodsSchema>;

export type CreateGoodsBody = z.output<
  typeof createGoodsSchema
>;

export type UpdateGoodsBody = z.output<
  typeof updateGoodsSchema
>;

export type CreateGoodsFormInput = z.input<
  typeof createGoodsSchema
>;

export type UpdateGoodsFormInput = z.input<
  typeof updateGoodsSchema
>;