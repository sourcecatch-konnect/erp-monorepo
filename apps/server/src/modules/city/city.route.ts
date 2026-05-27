import { Router } from "express";
import { createCitySchema, updateCitySchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.city,
  createSchema: createCitySchema,
  updateSchema: updateCitySchema,
  permissionKey: "masters.city",
  listOptions: {
    searchableFields: ["name"],
    defaultInclude: {
      state: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    defaultOrderBy: { name: "asc" },

    blockDeleteIfExists: [
      {
        model: db.company,
        label: "Companies",
        where: (id: string) => ({ cityId: id }),
      },
      {
        model: db.warehouse,
        label: "Warehouses",
        where: (id: string) => ({ cityId: id }),
      },
      {
        model: db.customer,
        label: "Customers",
        where: (id: string) => ({ cityId: id }),
      },
      {
        model: db.transport,
        label: "Transports",
        where: (id: string) => ({ cityId: id }),
      },
      {
        model: db.pump,
        label: "Pumps",
        where: (id: string) => ({ cityId: id }),
      },
      {
        model: db.area,
        label: "Areas",
        where: (id: string) => ({ cityId: id }),
      },
    ],
  },
});

export default router;
