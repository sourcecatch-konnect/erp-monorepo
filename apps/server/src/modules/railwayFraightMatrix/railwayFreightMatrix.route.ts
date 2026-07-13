import { Router } from "express";

import {
  createRailwayFreightMatrixSchema,
  updateRailwayFreightMatrixSchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";

import { createCrudRouter } from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { BadRequestError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";

const moneyFields = ["freightAmount"];

const validateAreaCity = async ({
  sourceCityId,
  sourceAreaId,
  destinationCityId,
  destinationAreaId,
}: {
  sourceCityId: string;
  sourceAreaId?: string | null;
  destinationCityId: string;
  destinationAreaId?: string | null;
}) => {
  if (sourceAreaId) {
    const sourceArea = await db.area.findFirst({
      where: {
        id: sourceAreaId,
        cityId: sourceCityId,
      },
      select: { id: true },
    });

    if (!sourceArea) {
      throw new Error("Source area does not belong to selected source city.");
    }
  }

  if (destinationAreaId) {
    const destinationArea = await db.area.findFirst({
      where: {
        id: destinationAreaId,
        cityId: destinationCityId,
      },
      select: { id: true },
    });

    if (!destinationArea) {
      throw new Error(
        "Destination area does not belong to selected destination city.",
      );
    }
  }
};

const railwayFreightCrudRouter: Router = createCrudRouter({
  model: db.railwayFreightMatrix,

  createSchema: createRailwayFreightMatrixSchema,

  updateSchema: updateRailwayFreightMatrixSchema,

  permissionKey: "masters.railway-freight",

  hooks: {
    beforeCreate: async (data) => {
      await validateAreaCity({
        sourceCityId: data.sourceCityId,
        sourceAreaId: data.sourceAreaId,
        destinationCityId: data.destinationCityId,
        destinationAreaId: data.destinationAreaId,
      });

      const exists = await db.railwayFreightMatrix.findFirst({
        where: {
          wagonId: data.wagonId,
          sourceCityId: data.sourceCityId,
          destinationCityId: data.destinationCityId,
          sourceAreaId: data.sourceAreaId ?? null,
          destinationAreaId: data.destinationAreaId ?? null,
        },
        select: { id: true },
      });

      if (exists) {
        throw new Error(
          "Railway freight already exists for this wagon, route and area.",
        );
      }

      return convertRupeeFieldsToPaise(data, moneyFields);
    },

    beforeUpdate: async (data, row) => {
        const current = row as {
          id: string;
        wagonId: string;
        sourceCityId: string;
        sourceAreaId: string | null;
        destinationCityId: string;
        destinationAreaId: string | null;
      };
      const next = {
        wagonId: data.wagonId ?? current.wagonId,
        sourceCityId: data.sourceCityId ?? current.sourceCityId,
        sourceAreaId:
          data.sourceAreaId !== undefined
            ? data.sourceAreaId
            : current.sourceAreaId,
        destinationCityId: data.destinationCityId ?? current.destinationCityId,
        destinationAreaId:
          data.destinationAreaId !== undefined
            ? data.destinationAreaId
            : current.destinationAreaId,
      };

      await validateAreaCity({
        sourceCityId: next.sourceCityId,
        sourceAreaId: next.sourceAreaId,
        destinationCityId: next.destinationCityId,
        destinationAreaId: next.destinationAreaId,
      });

      const exists = await db.railwayFreightMatrix.findFirst({
        where: {
          wagonId: next.wagonId,
          sourceCityId: next.sourceCityId,
          destinationCityId: next.destinationCityId,
          sourceAreaId: next.sourceAreaId ?? null,
          destinationAreaId: next.destinationAreaId ?? null,
          NOT: {
            id: current.id,
          },
        },
        select: { id: true },
      });

      if (exists) {
        throw new Error(
          "Railway freight already exists for this wagon, route and area.",
        );
      }

      return convertRupeeFieldsToPaise(data, moneyFields);
    },
  },

  listOptions: {
    searchableFields: [],

    defaultInclude: {
      sourceCity: {
        select: {
          id: true,
          name: true,
        },
      },

      destinationCity: {
        select: {
          id: true,
          name: true,
        },
      },

      sourceArea: {
        select: {
          id: true,
          name: true,
          cityId: true,
        },
      },

      destinationArea: {
        select: {
          id: true,
          name: true,
          cityId: true,
        },
      },

      wagon: {
        select: {
          id: true,
          name: true,
        },
      },
    },

    defaultOrderBy: {
      createdAt: "desc",
    },

    blockDeleteIfExists: [],
  },
});

const router: Router = Router();

router.use(authMiddleware);

router.get(
  "/available-wagons",
  can(PERMS.MASTERS.RAILWAY_FREIGHT.VIEW),
  async (req, res) => {
    const sourceAreaId =
      typeof req.query.sourceAreaId === "string"
        ? req.query.sourceAreaId.trim()
        : "";
    const destinationAreaId =
      typeof req.query.destinationAreaId === "string"
        ? req.query.destinationAreaId.trim()
        : "";

    if (!sourceAreaId || !destinationAreaId) {
      throw new BadRequestError(
        "Source area and destination area are required",
      );
    }

    const [sourceArea, destinationArea] = await Promise.all([
      db.area.findUnique({
        where: { id: sourceAreaId },
        select: { id: true, cityId: true },
      }),
      db.area.findUnique({
        where: { id: destinationAreaId },
        select: { id: true, cityId: true },
      }),
    ]);

    if (!sourceArea?.cityId) {
      throw new BadRequestError("Source area not found");
    }

    if (!destinationArea?.cityId) {
      throw new BadRequestError("Destination area not found");
    }

    const rows = await db.railwayFreightMatrix.findMany({
      where: {
        sourceCityId: sourceArea.cityId,
        destinationCityId: destinationArea.cityId,
        OR: [
          {
            sourceAreaId: sourceArea.id,
            destinationAreaId: destinationArea.id,
          },
          {
            sourceAreaId: sourceArea.id,
            destinationAreaId: null,
          },
          {
            sourceAreaId: null,
            destinationAreaId: destinationArea.id,
          },
          {
            sourceAreaId: null,
            destinationAreaId: null,
          },
        ],
      },
      select: {
        wagonId: true,
        wagon: {
          select: {
            id: true,
            name: true,
            totalCft: true,
            capacityMt: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        wagon: {
          name: "asc",
        },
      },
    });

    const unique = new Map<
      string,
      {
        id: string;
        name: string;
        totalCft: number | null;
        capacityMt: number | null;
        isActive: boolean;
      }
    >();

    for (const row of rows) {
      if (row.wagon && !unique.has(row.wagonId)) {
        unique.set(row.wagonId, row.wagon);
      }
    }

    return sendOk(res, Array.from(unique.values()));
  },
);

router.use("/", railwayFreightCrudRouter);

export default router;
