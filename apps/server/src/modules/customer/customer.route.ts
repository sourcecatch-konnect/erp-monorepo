import { Router } from "express";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

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
      state: {
        select: {
          id: true,
          name: true,
        },
      },
      city: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    defaultOrderBy: { name: "asc" },

    blockDeleteIfExists: [
      {
        model: db.agreement,
        label: "Agreements",
        where: (id: string) => ({ clientId: id }),
        select: {
          id: true,
          cityId: true,
        },
        getName: (row: any) => row.id,
      },
      {
        model: db.orderBooking,
        label: "Order Bookings",
        where: (id: string) => ({ customerId: id }),
        select: {
          id: true,
        },
        getName: (row: any) => row.id,
      },
      {
        model: db.lorryReceipt,
        label: "Lorry Receipts",
        where: (id: string) => ({ consigneeId: id }),
        select: {
          id: true,
        },
        getName: (row: any) => row.id,
      },
      {
        model: db.vehicleTrip,
        label: "Vehicle Trips",
        where: (id: string) => ({ consignorId: id }),
        select: {
          tripId: true,
        },
        getName: (row: any) => row.tripId,
      },
    ],
  },
});

export default router;