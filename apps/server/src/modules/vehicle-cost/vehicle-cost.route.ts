import { Router } from "express";
import { z } from "zod";
import { PERMS } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { sendOk } from "../_shared/response.js";
import { NotFoundError, ValidationError } from "../../lib/error.js";
import {
  MONTH_RE,
  listMonthlyCosts,
  upsertCostDefault,
  upsertMonthlyCost,
} from "./vehicle-cost.service.js";

const router: Router = Router();
router.use(authMiddleware);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

/** Whole paise as a digit string (JSON can't carry BigInt). */
const paise = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d{1,15}$/.test(v), "Amount must be a non-negative whole number of paise")
  .transform((v) => BigInt(v));

const fixedSchema = z.object({
  taxPaise: paise,
  insurancePaise: paise,
  permitPaise: paise,
  fitnessPaise: paise,
  emiPaise: paise,
});

const monthlySchema = fixedSchema.extend({
  salaryPaise: paise,
  tyrePaise: paise,
  otherPaise: paise,
  remarks: z.string().max(500).nullish(),
});

const parseMonth = (value: unknown): string => {
  if (typeof value !== "string" || !MONTH_RE.test(value))
    throw new ValidationError("month must look like 2026-08");
  return value;
};

const requireOwnVehicle = async (vehicleId: string) => {
  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { ownershipType: true },
  });
  if (!vehicle) throw new NotFoundError("Vehicle not found");
  if (vehicle.ownershipType !== "Own_Vehicle")
    throw new ValidationError("Costs are tracked for own vehicles only");
};

/* Every own vehicle's effective costs for a month (defaults where unsaved) */
router.get("/", can(PERMS.LOGSLIP.VIEW), async (req, res) => {
  const month = parseMonth(req.query.month);
  return sendOk(res, await listMonthlyCosts(month));
});

// Declared before "/:vehicleId/:month" so "defaults" is not read as a vehicle id.
/* Standing monthly defaults (tax, insurance, permit, fitness, EMI) */
router.put(
  "/defaults/:vehicleId",
  can(PERMS.LOGSLIP.POST_ACCOUNTS),
  async (req, res) => {
    const vehicleId = String(req.params.vehicleId);
    const parsed = fixedSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    await requireOwnVehicle(vehicleId);
    await upsertCostDefault(vehicleId, parsed.data, actorId(req));
    return sendOk(res, { vehicleId });
  },
);

/* Save one vehicle's costs for a month */
router.put(
  "/:vehicleId/:month",
  can(PERMS.LOGSLIP.POST_ACCOUNTS),
  async (req, res) => {
    const vehicleId = String(req.params.vehicleId);
    const month = parseMonth(req.params.month);
    const parsed = monthlySchema.safeParse(req.body);
    if (!parsed.success)
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    await requireOwnVehicle(vehicleId);
    const row = await upsertMonthlyCost(vehicleId, month, parsed.data, actorId(req));
    return sendOk(res, { id: row.id });
  },
);

/* Discard a month's saved row so the vehicle falls back to its defaults */
router.delete(
  "/:vehicleId/:month",
  can(PERMS.LOGSLIP.POST_ACCOUNTS),
  async (req, res) => {
    const vehicleId = String(req.params.vehicleId);
    const month = parseMonth(req.params.month);
    await db.vehicleMonthlyCost.deleteMany({ where: { vehicleId, month } });
    return sendOk(res, { vehicleId, month });
  },
);

export default router;
