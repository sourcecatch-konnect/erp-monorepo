import { Router } from "express";
import { createDriverSchema, updateDriverSchema } from "@skerp/validators";
import { randomUUID } from "node:crypto";
import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";
import { presignDownload, presignUpload } from "../../lib/s3.js";

const moneyFields = ["salary"];

const normalizeDriverName = (value: string) => value.trim().toLowerCase();

const withActiveLRGroupAssignment = async (rows: unknown[]) => {
  const drivers = rows as Record<string, unknown>[];
  const driverNames = drivers
    .map((d) =>
      typeof d.name === "string" ? normalizeDriverName(d.name) : null,
    )
    .filter((d): d is string => Boolean(d));

  if (driverNames.length === 0) return rows;

  const groups = await db.lRGroup.findMany({
    where: {
      deletedAt: null,
      status: { in: ["DRAFT", "FINALISED"] },
      isMarketVehicle: true,
      marketDriverName: { not: null },
    },
    select: {
      groupNumber: true,
      marketDriverName: true,
    },
  });

  const requested = new Set(driverNames);
  const groupByDriver = new Map(
    groups
      .filter(
        (g) =>
          g.marketDriverName &&
          requested.has(normalizeDriverName(g.marketDriverName)),
      )
      .map((g) => [normalizeDriverName(g.marketDriverName!), g.groupNumber]),
  );

  return drivers.map((driver) => {
    const key =
      typeof driver.name === "string" ? normalizeDriverName(driver.name) : "";
    const activeGroupNumber = groupByDriver.get(key) ?? null;
    return {
      ...driver,
      isAssigned: Boolean(activeGroupNumber),
      activeGroupNumber,
    };
  });
};

const router = Router();
router.post("/_photo/upload-url", async (req, res, next) => {
  try {
    const { fileName, contentType, fileSize } = req.body;

    if (!fileName || !contentType) {
      throw new Error("fileName and contentType are required");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(contentType)) {
      throw new Error("Only JPG, PNG, and WebP driver photos are allowed.");
    }

    const MAX_DRIVER_PHOTO_SIZE = 500 * 1024; // 500 KB

    const fileSizeNumber = Number(fileSize);

    if (!Number.isFinite(fileSizeNumber) || fileSizeNumber <= 0) {
      throw new Error("Driver photo size is required.");
    }

    if (fileSizeNumber > MAX_DRIVER_PHOTO_SIZE) {
      throw new Error("Driver photo must be less than 500 KB.");
    }

    const extension =
      String(fileName)
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";

    const key = `drivers/photos/${Date.now()}-${randomUUID()}.${extension}`;

    const uploadUrl = await presignUpload(key, contentType);

    res.json({
      ok: true,
      data: {
        key,
        uploadUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});
router.get("/_photo/view-url", async (req, res, next) => {
  try {
    const key = String(req.query.key || "");

    if (!key) {
      throw new Error("Photo key is required");
    }

    if (!key.startsWith("drivers/photos/")) {
      throw new Error("Invalid driver photo path.");
    }

    const viewUrl = await presignDownload(key);

    res.json({
      ok: true,
      data: {
        viewUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});
const crudRouter: Router = createCrudRouter({
  model: db.driver,
  createSchema: createDriverSchema,
  updateSchema: updateDriverSchema,
  permissionKey: "masters.driver",

  hooks: {
    beforeCreate: async (data) => convertRupeeFieldsToPaise(data, moneyFields),

    beforeUpdate: async (data) => convertRupeeFieldsToPaise(data, moneyFields),

    beforeDelete: async (id: string) => {
      const usedInTrip = await db.vehicleTrip.findFirst({
        where: { driverId: id },
        select: { id: true },
      });

      if (usedInTrip) {
        throw new Error(
          "This driver cannot be deleted because existing vehicle trip records are linked with this driver. To preserve trip history, mark the driver as On Leave or Blacklisted instead.",
        );
      }
    },
  },

  listOptions: {
    searchableFields: [
      "name",
      "mobile",
      "licenseNo",
      "panNo",
      "aadharCardNo",
    ],
    lookupSelect: {
      id: true,
      name: true,
      status: true,
      onLeave: true,
      blackListed: true,
      mobile: true,
    },
    lookupOrderBy: { name: "asc" },
    defaultOrderBy: { name: "asc" },
    mapRows: withActiveLRGroupAssignment,
  },
});

router.use("/", crudRouter);

export default router;
