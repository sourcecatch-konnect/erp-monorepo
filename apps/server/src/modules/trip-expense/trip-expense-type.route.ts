import { Router } from "express";
import { createTripExpenseTypeSchema } from "@skerp/validators";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { ConflictError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";

const router: Router = Router();
router.use(authMiddleware);

const typeSelect = {
  id: true,
  code: true,
  name: true,
  requiresDieselDetails: true,
  isSystem: true,
  isActive: true,
  sortOrder: true,
} as const;

router.get("/", can(PERMS.TRIP_EXPENSE.VIEW), async (_req, res) => {
  const rows = await db.tripExpenseType.findMany({
    where: { isActive: true },
    select: typeSelect,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return sendOk(res, rows);
});

router.post("/", can(PERMS.TRIP_EXPENSE.CREATE), async (req, res) => {
  const parsed = createTripExpenseTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }

  const name = parsed.data.name.replace(/\s+/g, " ");
  const duplicate = await db.tripExpenseType.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw new ConflictError("This expense type already exists");

  const codeBase =
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase()
      .slice(0, 50) || "EXPENSE";
  let code = codeBase;
  let suffix = 2;
  while (await db.tripExpenseType.findUnique({ where: { code } })) {
    code = `${codeBase.slice(0, 46)}_${suffix++}`;
  }

  const last = await db.tripExpenseType.aggregate({
    _max: { sortOrder: true },
  });
  const created = await db.tripExpenseType.create({
    data: {
      code,
      name,
      sortOrder: (last._max.sortOrder ?? 0) + 10,
    },
    select: typeSelect,
  });
  return sendOk(res, created, undefined, 201);
});

export default router;
