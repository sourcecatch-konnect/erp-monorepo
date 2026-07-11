import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { sendOk } from "../_shared/response.js";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../lib/error.js";
import { store } from "./ewaybill.store.js";
import {
  authenticate,
  getGstinDetails,
  getHsnDetails,
  getTransporterDetails,
  isConfigured,
} from "./whitebooks.client.js";

const router = Router();

router.use(authMiddleware);

/** Inbox — list all EWBs assigned to this transporter (with optional filters). */
router.get("/", (req, res) => {
  const { fromState, fromGstin, status, date, search } = req.query as Record<
    string,
    string | undefined
  >;

  let rows = store.all();

  if (fromState) {
    rows = rows.filter((b) => String(b.fromStateCode) === fromState);
  }
  if (fromGstin) {
    rows = rows.filter((b) =>
      b.fromGstin.toLowerCase().includes(fromGstin.toLowerCase()),
    );
  }
  if (status) {
    rows = rows.filter((b) => b.status === status);
  }
  if (date) {
    rows = rows.filter((b) => b.generatedDate.startsWith(date));
  }
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (b) =>
        b.ewbNo.toLowerCase().includes(q) ||
        b.fromTrdName.toLowerCase().includes(q) ||
        b.toTrdName.toLowerCase().includes(q) ||
        b.docNo.toLowerCase().includes(q) ||
        b.vehicleNo.toLowerCase().includes(q),
    );
  }

  rows = [...rows].sort(
    (a, b) =>
      new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime(),
  );

  return sendOk(res, rows, { page: 0, size: rows.length, total: rows.length });
});

/** Dashboard summary — KPIs, expiring-soon, breakdown by origin state. */
router.get("/summary", (_req, res) => {
  const rows = store.all();
  const nowMs = Date.now();

  const active = rows.filter(
    (b) => b.status === "ACTIVE" || b.status === "IN_TRANSIT",
  );
  const partBPending = rows.filter((b) => b.status === "PART_B_PENDING");
  const inTransit = rows.filter((b) => b.status === "IN_TRANSIT");

  const expiringSoon = active
    .filter((b) => {
      const ms = new Date(b.validUntil).getTime() - nowMs;
      return ms > 0 && ms < 4 * 60 * 60 * 1000;
    })
    .sort(
      (a, b) =>
        new Date(a.validUntil).getTime() - new Date(b.validUntil).getTime(),
    );

  const byState = Object.values(
    rows.reduce<
      Record<string, { stateCode: number; stateName: string; count: number }>
    >((acc, b) => {
      const key = String(b.fromStateCode);
      if (!acc[key]) {
        acc[key] = {
          stateCode: b.fromStateCode,
          stateName: b.fromStateName,
          count: 0,
        };
      }
      acc[key].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  return sendOk(res, {
    counts: {
      total: rows.length,
      active: active.length,
      inTransit: inTransit.length,
      partBPending: partBPending.length,
      expiringSoon: expiringSoon.length,
    },
    expiringSoon,
    byState,
    liveApiConfigured: isConfigured(),
  });
});

/** EWB detail by number. */
router.get("/:ewbNo", (req, res) => {
  const bill = store.get(req.params.ewbNo!);
  if (!bill) throw new NotFoundError("E-way bill not found");
  return sendOk(res, bill);
});

const updateVehicleSchema = z.object({
  vehicleNo: z
    .string()
    .min(7, "Vehicle number too short")
    .max(20)
    .regex(/^[A-Za-z0-9 -]+$/, "Invalid vehicle number"),
  transDocNo: z.string().max(40).optional(),
  transDocDate: z.string().optional(),
  fromPlace: z.string().min(2).max(60),
  fromState: z.coerce.number().int().min(1).max(99),
  reasonCode: z.enum(["1", "2", "3", "4"]),
  reasonRem: z.string().min(3).max(200),
  transMode: z.enum(["ROAD", "RAIL", "AIR", "SHIP"]),
});

router.post("/:ewbNo/update-vehicle", (req, res) => {
  const parsed = updateVehicleSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const existing = store.get(req.params.ewbNo!);
  if (!existing) throw new NotFoundError("E-way bill not found");
  if (existing.status === "DELIVERED" || existing.status === "CANCELLED") {
    throw new BadRequestError(
      `Cannot update vehicle on a ${existing.status.toLowerCase()} e-way bill`,
    );
  }

  const updated = store.updateVehicle(req.params.ewbNo!, parsed.data);
  return sendOk(res, updated);
});

const extendSchema = z.object({
  remainingDistanceKm: z.coerce.number().min(1).max(4000),
  extnRsnCode: z.enum(["1", "2", "3", "4", "5"]),
  extnRemarks: z.string().min(3).max(200),
  fromPlace: z.string().min(2).max(60),
  additionalHours: z.coerce.number().int().min(1).max(96),
});

router.post("/:ewbNo/extend", (req, res) => {
  const parsed = extendSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const existing = store.get(req.params.ewbNo!);
  if (!existing) throw new NotFoundError("E-way bill not found");
  if (existing.status === "DELIVERED" || existing.status === "CANCELLED") {
    throw new BadRequestError(
      `Cannot extend a ${existing.status.toLowerCase()} e-way bill`,
    );
  }

  const updated = store.extend(req.params.ewbNo!, parsed.data);
  return sendOk(res, updated);
});

/** Live API probes — proves the WhiteBooks integration is real, not mocked. */
router.get("/live/status", async (_req, res) => {
  if (!isConfigured()) {
    return sendOk(res, { configured: false });
  }
  const result = await authenticate();
  return sendOk(res, { configured: true, result });
});

router.get("/live/gstin/:gstin", async (req, res) => {
  const result = await getGstinDetails(req.params.gstin!);
  return sendOk(res, result);
});

router.get("/live/hsn/:hsn", async (req, res) => {
  const result = await getHsnDetails(req.params.hsn!);
  return sendOk(res, result);
});

router.get("/live/transporter/:trn", async (req, res) => {
  const result = await getTransporterDetails(req.params.trn!);
  return sendOk(res, result);
});

export default router;
