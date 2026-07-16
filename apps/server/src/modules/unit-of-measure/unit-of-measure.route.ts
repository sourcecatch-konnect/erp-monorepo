import { Router } from "express";
import {
  createUnitOfMeasureSchema,
  updateUnitOfMeasureSchema,
} from "@skerp/validators";
import { ZodTypeAny } from "zod";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.unitOfMeasure,

  createSchema: createUnitOfMeasureSchema as ZodTypeAny,
  updateSchema: updateUnitOfMeasureSchema as ZodTypeAny,

  permissionKey: "masters.unit-of-measure",

  uniqueErrorMessages: {
    code: "A unit with this code already exists.",
  },

  listOptions: {
    searchableFields: ["code", "name", "description"],
    defaultOrderBy: {
      name: "asc",
    },
    blockDeleteIfExists: [
      {
        model: db.orderConsignment,
        label: "Order Consignments",
        where: (id: string) => ({ weightUnitId: id }),
        select: { id: true },
        getName: (row: { id: string }) => row.id,
      },
      {
        model: db.orderConsignmentGoods,
        label: "Order Consignment Goods",
        where: (id: string) => ({
          OR: [{ quantityUnitId: id }, { weightUnitId: id }],
        }),
        select: { id: true },
        getName: (row: { id: string }) => row.id,
      },
      {
        model: db.lorryReceipt,
        label: "Lorry Receipts",
        where: (id: string) => ({ weightUnitId: id }),
        select: { id: true },
        getName: (row: { id: string }) => row.id,
      },
      {
        model: db.lRGoods,
        label: "LR Goods",
        where: (id: string) => ({
          OR: [{ quantityUnitId: id }, { weightUnitId: id }],
        }),
        select: { id: true },
        getName: (row: { id: string }) => row.id,
      },
      {
        model: db.gRNGoods,
        label: "GRN Goods",
        where: (id: string) => ({
          OR: [{ quantityUnitId: id }, { weightUnitId: id }],
        }),
        select: { id: true },
        getName: (row: { id: string }) => row.id,
      },
    ],
  },
});

export default router;
