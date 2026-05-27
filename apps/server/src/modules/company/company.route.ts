import { Router } from "express";
import {
  createCompanySchema,
  updateCompanySchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { ZodTypeAny } from "zod";

const router: Router = createCrudRouter({
  model: db.company,
  createSchema: createCompanySchema as ZodTypeAny,
  updateSchema: updateCompanySchema as ZodTypeAny,
  permissionKey: "masters.company",
  listOptions: {
    searchableFields: [
      "name",
      "address",
      "country",
      "contactPhone",
      "companyPAN",
      "companyTAN",
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
    model: db.branch,
    label: "Branches",
    where: (id: string) => ({ companyId: id }),
  },
  {
    model: db.user,
    label: "Users",
    where: (id: string) => ({ companyId: id }),
    select: {
      id: true,
      userName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
    getName: (row: any) =>
      row.userName ||
      `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() ||
      row.email ||
      row.id,
  },
  {
    model: db.agreement,
    label: "Agreements",
    where: (id: string) => ({ companyId: id }),
    select: {
      id: true,
      clientId: true,
    },
    getName: (row: any) => row.clientId || row.id,
  },
],
  },
});

export default router;