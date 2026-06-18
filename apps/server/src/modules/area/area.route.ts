import { Router } from "express";
import { createAreaSchema, updateAreaSchema } from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router = createCrudRouter({
  model: db.area,
  createSchema: createAreaSchema,
  updateSchema: updateAreaSchema,
  permissionKey: "masters.area",
  uniqueErrorMessages: {
    cityId_name: "This area already exists in the selected city.",
    googlePlaceId: "This Google Place already exists.",
  },
  listOptions: {
    searchableFields: ["name", "formattedAddress"],
    defaultSelect: {
      id: true,
      name: true,
      cityId: true,
      googlePlaceId: true,
      formattedAddress: true,
      latitude: true,
      longitude: true,
      city: {
        select: {
          id: true,
          name: true,
          state: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    defaultOrderBy: { name: "asc" },
  },
});

export default router;