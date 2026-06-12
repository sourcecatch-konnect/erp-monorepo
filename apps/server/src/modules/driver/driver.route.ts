import { Router } from "express";
import {
  createDriverSchema,
  updateDriverSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";
import { convertRupeeFieldsToPaise } from "../../lib/money.js";

const moneyFields = ["salary", "noTDSApplyAmount"];

const router: Router = createCrudRouter({
  model: db.driver,
  createSchema: createDriverSchema,
  updateSchema: updateDriverSchema,
  permissionKey: "masters.driver",
  hooks: {
    beforeCreate: async (data: any) => convertRupeeFieldsToPaise(data, moneyFields),
    beforeUpdate: async (data: any) => convertRupeeFieldsToPaise(data, moneyFields),
  },
  listOptions: {
    searchableFields: [
      "name",
      "mobile",
      "alternateMobile",
      "licenseNo",
      "panNo",
      "aadharCardNo",
    ],
    defaultOrderBy: { name: "asc" },
  },
});

export default router;
