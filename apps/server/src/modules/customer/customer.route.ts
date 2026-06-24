import { Router } from "express";
import {
  createCustomerSchema,
  updateCustomerSchema,
  createCustomerLocationSchema,
  updateCustomerLocationSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";
import { can } from "../../auth/can.middleware.js";
import { getParamId } from "../_shared/param.js";
import { sendOk } from "../_shared/response.js";
import { NotFoundError, ValidationError } from "../../lib/error.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";

const moneyFields = ["creditLimit"];

const router: Router = createCrudRouter({
  model: db.customer,
  createSchema: createCustomerSchema as ZodTypeAny,
  updateSchema: updateCustomerSchema as ZodTypeAny,
  permissionKey: "masters.customer",
  hooks: {
    beforeCreate: async (data: any) =>
      convertRupeeFieldsToPaise(data, moneyFields),
    beforeUpdate: async (data: any) =>
      convertRupeeFieldsToPaise(data, moneyFields),
  },
  listOptions: {
    searchableFields: [
      "name",
      "shortName",
      "customerPAN",
      "gstNo",
      "contactPhone",
      "primaryEmail",
      "contactPerson",
      "mobileNo",
      "website",
    ],
    defaultInclude: {
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
    },
    defaultOrderBy: { name: "asc" },

    blockDeleteIfExists: [
      {
        model: db.agreement,
        label: "Agreements",
        where: (id: string) => ({ clientId: id }),
        select: { id: true, cityId: true },
        getName: (row: any) => row.id,
      },
      {
        model: db.order,
        label: "Orders",
        where: (id: string) => ({ customerId: id }),
        select: { id: true, orderNumber: true },
        getName: (row: any) => row.orderNumber ?? row.id,
      },
      {
        model: db.lRGroup,
        label: "LR Groups",
        where: (id: string) => ({
          OR: [{ consignorId: id }, { consigneeId: id }],
        }),
        select: { id: true, groupNumber: true },
        getName: (row: any) => row.groupNumber ?? row.id,
      },
      {
        model: db.vehicleTrip,
        label: "Vehicle Trips",
        where: (id: string) => ({ consignorId: id }),
        select: { id: true },
        getName: (row: any) => row.id,
      },
    ],
  },
});

/* ------------------------------------------------------------------ */
/* CustomerLocation (inline-lite saved pickup points)                 */
/* Nested under /customers. authMiddleware already applied by factory. */
/* ------------------------------------------------------------------ */
const customerLocationInclude = {
  city: { select: { id: true, name: true } },
  area: {
    select: {
      id: true,
      name: true,
      cityId: true,
      formattedAddress: true,
    },
  },
};
// List a customer's saved pickup locations (used by the Order form dropdown).
router.get("/:id/locations", can("masters.customer.view"), async (req, res) => {
  const customerId = getParamId(req);
  console.log("CUSTOMER LOCATION FILTER:", {
    customerId,
    query: req.query,
  });

  const cityId =
    typeof req.query.cityId === "string" && req.query.cityId.trim()
      ? req.query.cityId.trim()
      : undefined;

  const locations = await db.customerLocation.findMany({
    where: {
      customerId,
      ...(cityId ? { cityId } : {}),
    },
    include: customerLocationInclude,
    orderBy: { name: "asc" },
  });

  return sendOk(res, locations);
});

router.post(
  "/:id/locations",
  can("masters.customer.update"),
  async (req, res) => {
    const customerId = getParamId(req);
    const customer = await db.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundError("Customer not found");

    const parsed = createCustomerLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const location = await db.customerLocation.create({
      data: { ...parsed.data, customerId },
      include: customerLocationInclude,
    });
    return sendOk(res, location, undefined, 201);
  },
);

router.patch(
  "/locations/:locationId",
  can("masters.customer.update"),
  async (req, res) => {
    const locationId = req.params.locationId;
    if (typeof locationId !== "string" || !locationId) {
      throw new ValidationError("Invalid location id");
    }

    const existing = await db.customerLocation.findUnique({
      where: { id: locationId },
    });
    if (!existing) throw new NotFoundError("Location not found");

    const parsed = updateCustomerLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const location = await db.customerLocation.update({
      where: { id: locationId },
      data: parsed.data,
      include: customerLocationInclude,
    });
    return sendOk(res, location);
  },
);

router.delete(
  "/locations/:locationId",
  can("masters.customer.update"),
  async (req, res) => {
    const locationId = Array.isArray(req.params.locationId)
      ? req.params.locationId[0]
      : req.params.locationId;

    if (!locationId) {
      throw new ValidationError("Invalid location id");
    }

    const existing = await db.customerLocation.findUnique({
      where: { id: locationId },
    });

    if (!existing) {
      throw new NotFoundError("Location not found");
    }

    const orderCount = await db.order.count({
      where: { customerLocationId: locationId },
    });

    if (orderCount > 0) {
      throw new ValidationError(
        `Cannot delete location because it is used in ${orderCount} order(s)`,
      );
    }

    const unloadingCount = await db.tripUnloadingPoint.count({
      where: { locationId },
    });

    if (unloadingCount > 0) {
      throw new ValidationError(
        `Cannot delete location because it is used in ${unloadingCount} trip unloading point(s)`,
      );
    }

    await db.customerLocation.delete({
      where: { id: locationId },
    });

    return sendOk(res, { success: true });
  },
);
export default router;
