import { Router } from "express";
import { createCitySchema, updateCitySchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

function normalizeCityName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
function duplicateCityError(name: string) {
  const error = new Error(`City "${name}" already exists in selected state`);

  (error as any).statusCode = 409;
  (error as any).details = {
    fieldErrors: {
      name: [`City "${name}" already exists in selected state`],
    },
  };

  return error;
}
const router: Router = createCrudRouter({
  model: db.city,
  createSchema: createCitySchema as ZodTypeAny,
  updateSchema: updateCitySchema as ZodTypeAny,
  permissionKey: "masters.city",

  hooks: {
  beforeCreate: async (data: any) => {
    const name = normalizeCityName(data.name);

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
      throw duplicateCityError(name);
    }

    data.name = name;

    return data;
  },

  beforeUpdate: async (data: any, row: any) => {
    const currentCity = row as {
      id: string;
      name: string;
      stateId: string;
    };

    const name = data.name
      ? normalizeCityName(data.name)
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
      throw duplicateCityError(name);
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
    ],
  },
});

export default router;