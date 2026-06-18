import { Router } from "express";
import { createCitySchema, updateCitySchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";
import { createDuplicateError, normalizeName } from "../_shared/NameNormalized.js";

  
const router: Router = createCrudRouter({
  model: db.city,
  createSchema: createCitySchema as ZodTypeAny,
  updateSchema: updateCitySchema as ZodTypeAny,
  permissionKey: "masters.city",

  hooks: {
  beforeCreate: async (data: any) => {
    const name = normalizeName(data.name);

    const existing = await db.city.findFirst({
      where: {
        stateId: data.stateId,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
 throw createDuplicateError(
  "name",
  `City "${name}" already exists in selected state`
);
    }

    data.name = name;

    return data;
  },
  beforeDelete: async (id) => {
  const usedInRailwayFreightMatrix =
    await db.railwayFreightMatrix.findFirst({
      where: {
        OR: [
          { sourceCityId: id },
          { destinationCityId: id },
        ],
      },
      select: { id: true },
    });

  if (usedInRailwayFreightMatrix) {
    throw new Error(
      "Cannot delete this city because it is used in Railway Freight Matrix."
    );
  }
},
  beforeUpdate: async (data: any, row: any) => {
    const currentCity = row as {
      id: string;
      name: string;
      stateId: string;
    };

    const name = data.name
      ? normalizeName(data.name)
      : currentCity.name;

    const stateId = data.stateId ?? currentCity.stateId;

    const existing = await db.city.findFirst({
      where: {
        id: {
          not: currentCity.id,
        },
        stateId,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      throw createDuplicateError(
  "name",
  `City "${name}" already exists in selected state`
);
    }

    data.name = name;

    return data;
  },
},

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
        {
    model: db.sparePartSupplier,
    label: "Spare Part Suppliers",
    where: (id: string) => ({ cityId: id }),
  },
    ],
  },
});

export default router;