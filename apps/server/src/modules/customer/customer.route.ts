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

const router: Router = createCrudRouter({
  model: db.customer,
  createSchema: createCustomerSchema as ZodTypeAny,
  updateSchema: updateCustomerSchema as ZodTypeAny,
  permissionKey: "masters.customer",
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
        model: db.lorryReceipt,
        label: "Lorry Receipts",
        where: (id: string) => ({ consigneeId: id }),
        select: { id: true },
        getName: (row: any) => row.id,
      },
      {
        model: db.vehicleTrip,
        label: "Vehicle Trips",
        where: (id: string) => ({ consignorId: id }),
        select: { tripId: true },
        getName: (row: any) => row.tripId,
      },
    ],
  },
});

/* ------------------------------------------------------------------ */
/* CustomerLocation (inline-lite saved pickup points)                 */
/* Nested under /customers. authMiddleware already applied by factory. */
/* ------------------------------------------------------------------ */

// List a customer's saved pickup locations (used by the Order form dropdown).
router.get(
  "/:id/locations",
  can("masters.customer.view"),
  async (req, res) => {
    const customerId = getParamId(req);
    const locations = await db.customerLocation.findMany({
      where: { customerId },
      include: { city: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return sendOk(res, locations);
  }
);

router.post(
  "/:id/locations",
  can("masters.customer.update"),
  async (req, res) => {
    const customerId = getParamId(req);
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundError("Customer not found");

    const parsed = createCustomerLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const location = await db.customerLocation.create({
      data: { ...parsed.data, customerId },
      include: { city: { select: { id: true, name: true } } },
    });
    return sendOk(res, location, undefined, 201);
  }
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
      include: { city: { select: { id: true, name: true } } },
    });
    return sendOk(res, location);
  }
);

router.delete(
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

    await db.customerLocation.delete({ where: { id: locationId } });
    return sendOk(res, { success: true });
  }
);

export default router;
