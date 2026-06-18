import { Router } from "express";
import { createStateSchema, updateStateSchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { normalizeName ,  createDuplicateError} from "../_shared/NameNormalized.js";



const router: Router = createCrudRouter({
  model: db.state,
  createSchema: createStateSchema,
  updateSchema: updateStateSchema,
  permissionKey: "masters.state",

  hooks: {
    beforeCreate: async (data: any) => {
      const name = normalizeName(data.name);


      const existing = await db.state.findFirst({
        where: {
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
      });

      if (existing) {
        throw createDuplicateError(
  "name",
  `State "${name}" already exists`
);
      }

      data.name = name;

      return data;
    },

    beforeUpdate: async (data: any, row: any) => {
      if (!data.name) return data;

      const name = normalizeName(data.name);

      const existing = await db.state.findFirst({
        where: {
          id: {
            not: row.id,
          },
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
      });

       if (existing) {
        throw createDuplicateError(
  "name",
  `State "${name}" already exists`
);
      }

      data.name = name;

      return data;
    },
  },

  listOptions: {
    searchableFields: ["name"],
    defaultOrderBy: { name: "asc" },

    blockDeleteIfExists: [
      {
        model: db.city,
        label: "Cities",
        where: (id: string) => ({ stateId: id }),
      },
      {
        model: db.company,
        label: "Companies",
        where: (id: string) => ({ stateId: id }),
      },
      {
        model: db.warehouse,
        label: "Warehouses",
        where: (id: string) => ({ stateId: id }),
      },
      {
        model: db.customer,
        label: "Customers",
        where: (id: string) => ({ stateId: id }),
      },
      {
        model: db.transport,
        label: "Transports",
        where: (id: string) => ({ stateId: id }),
      },
      {
        model: db.pump,
        label: "Pumps",
        where: (id: string) => ({ stateId: id }),
      },
    ],
  },
});
export default router;