import { Router } from "express";
import {
  createVehicleSchema,
  updateVehicleSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

const normalizeVehicleNumber = (value: string) =>
  value.toUpperCase().replace(/\s+/g, "");

const withActiveLRGroupAssignment = async (rows: unknown[]) => {
  const vehicles = rows as Record<string, unknown>[];
  const vehicleNumbers = vehicles
    .map((v) =>
      typeof v.vehicleNumber === "string"
        ? normalizeVehicleNumber(v.vehicleNumber)
        : null,
    )
    .filter((v): v is string => Boolean(v));

  if (vehicleNumbers.length === 0) return rows;

  const groups = await db.lRGroup.findMany({
    where: {
      deletedAt: null,
      status: { in: ["DRAFT", "FINALISED"] },
      isMarketVehicle: true,
      marketVehicleNumber: { not: null },
    },
    select: {
      groupNumber: true,
      marketVehicleNumber: true,
    },
  });

  const requested = new Set(vehicleNumbers);
  const groupByVehicle = new Map(
    groups
      .filter(
        (g) =>
          g.marketVehicleNumber &&
          requested.has(normalizeVehicleNumber(g.marketVehicleNumber)),
      )
      .map((g) => [
        normalizeVehicleNumber(g.marketVehicleNumber!),
        g.groupNumber,
      ]),
  );

  return vehicles.map((vehicle) => {
    const key =
      typeof vehicle.vehicleNumber === "string"
        ? normalizeVehicleNumber(vehicle.vehicleNumber)
        : "";
    const activeGroupNumber = groupByVehicle.get(key) ?? null;
    return {
      ...vehicle,
      isAssigned: Boolean(activeGroupNumber),
      activeGroupNumber,
    };
  });
};

const router: Router = createCrudRouter({
  model: db.vehicle,
  createSchema: createVehicleSchema as ZodTypeAny,
  updateSchema: updateVehicleSchema as ZodTypeAny,
  permissionKey: "masters.vehicle",
  uniqueErrorMessages: {
  vehicleNumber: "This vehicle number already exists.",
  chasisNumber: "This chassis number already exists.",
  engineNumber: "This engine number already exists.",
},
  listOptions: {
    searchableFields: [
      "vehicleNumber",
      "chasisNumber",
      "engineNumber",
      "insuranceNumber",
      "insuranceCompany",
    ],
    defaultInclude: {
      vehicleTypeRef: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    defaultOrderBy: {
      vehicleNumber: "asc",
    },
    mapRows: withActiveLRGroupAssignment,
  },

  hooks: {
    beforeDelete: async (id: string) => {
      const usedInTrip = await db.vehicleTrip.findFirst({
        where: {
          vehicleId: id,
        },
        select: {
          id: true,
          tripNumber: true,
        },
      });

      if (usedInTrip) {
        throw new Error(
          `Cannot delete this vehicle because it is already used in vehicle trip ${
            usedInTrip.tripNumber ?? usedInTrip.id
          }.`
        );
      }
    },
  },
});

export default router;
