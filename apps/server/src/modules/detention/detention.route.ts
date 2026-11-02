import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createDetentionSlabSchema,
  detentionQuoteQuerySchema,
  updateDetentionSlabSchema,
} from "@skerp/validators";

import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { NotFoundError, ValidationError } from "../../lib/error.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { invalidateCacheOnWrite } from "../_shared/cache.js";
import { sendOk } from "../_shared/response.js";
import {
  DETENTION_SLAB_NAMESPACE,
  quoteChallanDetention,
} from "./detention.service.js";

const router: Router = Router();
router.use(authMiddleware);

/**
 * Any write here orphans the cached slab list, so the next quote reloads it.
 * The TTL is only a backstop — this is the correctness path.
 */
router.use(invalidateCacheOnWrite(DETENTION_SLAB_NAMESPACE));

const slabSelect = {
  id: true,
  name: true,
  transportId: true,
  customerId: true,
  vehicleTypeId: true,
  freightFromPaise: true,
  freightToPaise: true,
  basis: true,
  firstDayFree: true,
  lastDayFree: true,
  freeHours: true,
  blockHours: true,
  priority: true,
  effectiveFrom: true,
  effectiveTo: true,
  isActive: true,
  transport: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  vehicleType: { select: { id: true, name: true } },
  bands: {
    orderBy: { fromUnit: "asc" },
    select: { id: true, fromUnit: true, toUnit: true, ratePaise: true },
  },
} as const;

const actorId = (req: { user?: { userId: string } }): string => req.user!.userId;

/* ───────────────────────── slab master ───────────────────────── */

const SLAB_SORT_FIELDS = new Set(["name", "priority", "effectiveFrom", "createdAt"]);

/**
 * Paged like every other master list (`?page=&size=&sort=&search=&filter[k]=v`).
 * The quote path does NOT come through here — it uses the cached full set in
 * `loadActiveSlabs`, which is deliberately unpaged because matching has to see
 * every candidate.
 */
router.get("/slabs", can(PERMS.MASTERS.DETENTION_SLAB.VIEW), async (req, res) => {
  const { page, size, search, sort, filter } = parseListQuery(req);

  const where: Prisma.DetentionSlabWhereInput = {
    deletedAt: null,
    ...(filter.transportId ? { transportId: filter.transportId } : {}),
    ...(filter.vehicleTypeId ? { vehicleTypeId: filter.vehicleTypeId } : {}),
    ...(filter.basis === "DAY" || filter.basis === "HOUR"
      ? { basis: filter.basis }
      : {}),
    ...(filter.isActive ? { isActive: filter.isActive === "true" } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { transport: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  // Count and page in one round trip rather than two sequential awaits.
  const [total, rows] = await Promise.all([
    db.detentionSlab.count({ where }),
    db.detentionSlab.findMany({
      where,
      orderBy:
        sort && SLAB_SORT_FIELDS.has(sort.field)
          ? { [sort.field]: sort.direction }
          : [{ isActive: "desc" }, { priority: "desc" }, { name: "asc" }],
      skip: page * size,
      take: size,
      select: slabSelect,
    }),
  ]);

  return sendOk(res, rows, { page, size, total });
});

router.get(
  "/slabs/:id",
  can(PERMS.MASTERS.DETENTION_SLAB.VIEW),
  async (req, res) => {
    const row = await db.detentionSlab.findFirst({
      where: { id: getParamId(req), deletedAt: null },
      select: slabSelect,
    });
    if (!row) throw new NotFoundError("Detention slab not found");
    return sendOk(res, row);
  },
);

router.post(
  "/slabs",
  can(PERMS.MASTERS.DETENTION_SLAB.CREATE),
  async (req, res) => {
    const parsed = createDetentionSlabSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const { bands, ...slab } = parsed.data;

    const row = await db.detentionSlab.create({
      data: {
        ...slab,
        freightFromPaise:
          slab.freightFromPaise === null ? null : BigInt(slab.freightFromPaise),
        freightToPaise:
          slab.freightToPaise === null ? null : BigInt(slab.freightToPaise),
        createdById: actorId(req),
        bands: {
          create: bands.map((band) => ({
            fromUnit: band.fromUnit,
            toUnit: band.toUnit,
            ratePaise: BigInt(band.ratePaise),
          })),
        },
      },
      select: slabSelect,
    });
    return sendOk(res, row, undefined, 201);
  },
);

router.put(
  "/slabs/:id",
  can(PERMS.MASTERS.DETENTION_SLAB.UPDATE),
  async (req, res) => {
    const parsed = updateDetentionSlabSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const { bands, ...slab } = parsed.data;
    const id = getParamId(req);

    const existing = await db.detentionSlab.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Detention slab not found");

    // Bands are replaced wholesale: the validator guarantees the incoming set
    // tiles the run without gaps, and a partial update could not.
    const row = await db.$transaction(async (tx) => {
      await tx.detentionSlabBand.deleteMany({ where: { slabId: id } });
      return tx.detentionSlab.update({
        where: { id },
        data: {
          ...slab,
          freightFromPaise:
            slab.freightFromPaise === null
              ? null
              : BigInt(slab.freightFromPaise),
          freightToPaise:
            slab.freightToPaise === null ? null : BigInt(slab.freightToPaise),
          bands: {
            create: bands.map((band) => ({
              fromUnit: band.fromUnit,
              toUnit: band.toUnit,
              ratePaise: BigInt(band.ratePaise),
            })),
          },
        },
        select: slabSelect,
      });
    });
    return sendOk(res, row);
  },
);

router.delete(
  "/slabs/:id",
  can(PERMS.MASTERS.DETENTION_SLAB.DELETE),
  async (req, res) => {
    const existing = await db.detentionSlab.findFirst({
      where: { id: getParamId(req), deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Detention slab not found");

    // Soft delete — a past quote must stay explainable by the slab that
    // produced it.
    await db.detentionSlab.update({
      where: { id: getParamId(req) },
      data: { deletedAt: new Date(), isActive: false },
    });
    return sendOk(res, { id: getParamId(req) });
  },
);

/* ───────────────────────── the quote ───────────────────────── */

/**
 * Computes detention for a challan without writing anything. Gated on the
 * challan's own view permission, not the slab master's — anyone who can see
 * the challan can see what it would cost.
 */
router.get(
  "/challans/:id/quote",
  can(PERMS.DELIVERY_CHALLAN.VIEW),
  async (req, res) => {
    const parsed = detentionQuoteQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }
    const quote = await quoteChallanDetention(getParamId(req), parsed.data);
    return sendOk(res, quote);
  },
);

export default router;
