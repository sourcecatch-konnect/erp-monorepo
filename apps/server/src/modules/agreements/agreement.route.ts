import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createAgreementSchema,
  updateAgreementSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router: Router =
  createCrudRouter({
    model: db.agreement,

    createSchema:
      createAgreementSchema as ZodTypeAny,

    updateSchema:
      updateAgreementSchema as ZodTypeAny,

    permissionKey:
      "masters.agreement",

    listOptions: {
      searchableFields: [],

      defaultInclude: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },

        client: {
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

        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      defaultOrderBy: {
        agreementDate: "desc",
      },

      blockDeleteIfExists: [
        {
          model:
            db.detentionRate,

          label:
            "Detention Rates",

          where: (
            id: string
          ) => ({
            agreementId: id,
          }),

          select: {
            id: true,
          },

          getName: (
            row: any
          ) => row.id,
        },

        {
          model:
            db.rateMatrix,

          label:
            "Rate Matrix",

          where: (
            id: string
          ) => ({
            agreementId: id,
          }),

          select: {
            id: true,
          },

          getName: (
            row: any
          ) => row.id,
        },
      ],
    },
  });

export default router;