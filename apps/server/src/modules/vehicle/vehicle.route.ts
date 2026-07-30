import { Router } from "express";
import {
  createVehicleSchema,
  updateVehicleSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";
import { BadRequestError } from "../../lib/error.js";

type VehicleMutation = {
  ownershipType?: "Own_Vehicle" | "Market_Vehicle";
  transportId?: string | null;
};

const validateTransporter = async (
  data: VehicleMutation,
  existing?: VehicleMutation,
) => {
  const ownershipType = data.ownershipType ?? existing?.ownershipType;
  const requestedTransportId =
    data.transportId !== undefined
      ? data.transportId || null
      : existing?.transportId || null;

  if (ownershipType === "Market_Vehicle" && !requestedTransportId) {
    throw new BadRequestError(
      "Transporter is required for a market vehicle",
    );
  }

  if (ownershipType === "Own_Vehicle") {
    return { ...data, transportId: null };
  }

  if (requestedTransportId) {
    const transporter = await db.transport.findUnique({
      where: { id: requestedTransportId },
      select: { id: true },
    });

    if (!transporter) {
      throw new BadRequestError("Selected transporter was not found");
    }
  }

  return { ...data, transportId: requestedTransportId };
};

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
    lookupSelect: {
      id: true,
      vehicleNumber: true,
      status: true,
      ownershipType: true,
      transportId: true,
      capacityMT: true,
      vehicleTypeRef: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      transport: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    lookupOrderBy: {
      vehicleNumber: "asc",
    },
    defaultInclude: {
      vehicleTypeRef: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      transport: {
        select: {
          id: true,
          name: true,
          phoneNo: true,
        },
      },
    },
    defaultOrderBy: {
      vehicleNumber: "asc",
    },
    mapRows: withActiveLRGroupAssignment,
  },

  hooks: {
    beforeCreate: async (data) =>
      (await validateTransporter(
        data as VehicleMutation,
      )) as typeof data,
    beforeUpdate: async (data, row) =>
      (await validateTransporter(
        data as VehicleMutation,
        row as VehicleMutation,
      )) as typeof data,
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
