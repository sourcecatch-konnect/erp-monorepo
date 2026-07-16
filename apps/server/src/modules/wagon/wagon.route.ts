import { Router } from "express";
import { ZodTypeAny } from "zod";

import { createWagonSchema, updateWagonSchema } from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.wagon,

  createSchema: createWagonSchema as ZodTypeAny,

  updateSchema: updateWagonSchema as ZodTypeAny,

  permissionKey: "masters.wagon",
  uniqueErrorMessages: {
    name: "This wagon name already exists.",
  },
  listOptions: {
    searchableFields: ["name"],

    defaultOrderBy: {
      name: "asc",
    },

    blockDeleteIfExists: [
      {
        model: db.railwayFreightMatrix,
        label: "Railway Freight Matrix",
        where: (id: string) => ({
          wagon: {
            id,
          },
        }),
        select: {
          id: true,
        },
        getName: (row: { id: string }) => row.id,
      },
      {
        model: db.vPScheduleWagonCount,
        label: "VP Schedule",
        where: (id: string) => ({
          wagonId: id,
        }),
        select: {
          id: true,
        },
        getName: (row: { id: string }) => row.id,
      },
    ],
  },
});

export default router;
