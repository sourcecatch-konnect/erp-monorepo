import { Router } from "express";
import { ZodTypeAny } from "zod";

import {
  createAgreementSchema,
  updateAgreementSchema,
} from "@skerp/validators";

import { db } from "../../../prisma/prisma.js";
import { createCrudRouter } from "../_shared/crud.factory.js";

const router = Router();

const defaultInclude = {
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
};

router.get("/company/:companyId", async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const page = Number(req.query.page ?? 0);
    const size = Number(req.query.size ?? 25);
    const search = String(req.query.search ?? "").trim();

    const where = {
      companyId,

      ...(search
        ? {
            OR: [
              {
                client: {
                  name: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                city: {
                  name: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                branch: {
                  name: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      db.agreement.findMany({
        where,
        include: defaultInclude,
        orderBy: {
          agreementDate: "desc",
        },
        skip: page * size,
        take: size,
      }),

      db.agreement.count({
        where,
      }),
    ]);

    res.json({
      success: true,
      data,
      meta: {
        page,
        size,
        total,
        pageCount: Math.ceil(total / size),
      },
    });
  } catch (error) {
    next(error);
  }
});

const crudRouter: Router = createCrudRouter({
  model: db.agreement,

  createSchema: createAgreementSchema as ZodTypeAny,

  updateSchema: updateAgreementSchema as ZodTypeAny,

  permissionKey: "masters.agreement",

  listOptions: {
    searchableFields: [],

    defaultInclude,

    defaultOrderBy: {
      agreementDate: "desc",
    },

    blockDeleteIfExists: [
      {
        model: db.detentionRate,

        label: "Detention Rates",

        where: (id: string) => ({
          agreementId: id,
        }),

        select: {
          id: true,
        },

        getName: (row: any) => row.id,
      },

      {
        model: db.rateMatrix,

        label: "Rate Matrix",

        where: (id: string) => ({
          agreementId: id,
        }),

        select: {
          id: true,
        },

        getName: (row: any) => row.id,
      },
    ],
  },
});

router.use("/", crudRouter);

export default router;