import { Router } from "express";
import { z } from "zod";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import { sendOk } from "../_shared/response.js";

const router = Router();
router.use(authMiddleware);
router.use(can(PERMS.ADMIN.AUDIT_LOG_VIEW));

const querySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  // Inclusive lower / exclusive upper bound on createdAt. The client sends
  // local-day boundaries as ISO instants so "Today" means the viewer's today.
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(50),
});

/* ------------------------------------------------------------------ */
/* Reference labels                                                    */
/* ------------------------------------------------------------------ */
// Audit rows store raw ids (entityId, roleId, driverIds, …). The viewer only
// holds admin.audit_log.view — not the RBAC / master permissions needed to
// look those ids up — so resolve them to display names here, one batched
// query per table for the whole page.
//
// Ids inside before/after are recognised by key name, at any depth (so a
// `lines[].driverId` works too). A module writing audit entries only has to
// use these conventional keys to get names in the audit log for free.

type RefKind =
  | "role"
  | "user"
  | "branch"
  | "driver"
  | "vehicle"
  | "slip"
  | "trip"
  | "journey";

const ENTITY_REF_KIND: Record<string, RefKind> = {
  Role: "role",
  User: "user",
  Branch: "branch",
  Driver: "driver",
  Vehicle: "vehicle",
  VendorPaymentSlip: "slip",
  VehicleTrip: "trip",
  VehicleJourney: "journey",
};

const KEY_REF_KIND: Record<string, RefKind> = {
  roleId: "role",
  copiedFrom: "role",
  userId: "user",
  userIds: "user",
  branchId: "branch",
  branchIds: "branch",
  driverId: "driver",
  driverIds: "driver",
  vehicleId: "vehicle",
  vehicleIds: "vehicle",
};

const MAX_DEPTH = 4;

const asIds = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
};

const collectKeyedIds = (value: unknown, out: [RefKind, string][], depth = 0): void => {
  if (depth > MAX_DEPTH || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectKeyedIds(item, out, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const kind = KEY_REF_KIND[key];
    if (kind) for (const id of asIds(child)) out.push([kind, id]);
    else collectKeyedIds(child, out, depth + 1);
  }
};

type AuditRow = { entity: string; entityId: string; before: unknown; after: unknown };

const referencedIds = (row: AuditRow): [RefKind, string][] => {
  const refs: [RefKind, string][] = [];
  const entityKind = ENTITY_REF_KIND[row.entity];
  if (entityKind) refs.push([entityKind, row.entityId]);
  collectKeyedIds(row.before, refs);
  collectKeyedIds(row.after, refs);
  return refs;
};

const resolveRefLabels = async (rows: AuditRow[]): Promise<Map<string, string>> => {
  const ids: Record<RefKind, Set<string>> = {
    role: new Set(),
    user: new Set(),
    branch: new Set(),
    driver: new Set(),
    vehicle: new Set(),
    slip: new Set(),
    trip: new Set(),
    journey: new Set(),
  };
  for (const row of rows) {
    for (const [kind, id] of referencedIds(row)) ids[kind].add(id);
  }
  const where = (kind: RefKind) => ({ id: { in: [...ids[kind]] } });
  const skip = (kind: RefKind) => ids[kind].size === 0;

  const [roles, users, branches, drivers, vehicles, slips, trips, journeys] = await Promise.all([
    skip("role") ? [] : db.role.findMany({ where: where("role"), select: { id: true, name: true } }),
    skip("user")
      ? []
      : db.user.findMany({
          where: where("user"),
          select: { id: true, firstName: true, lastName: true },
        }),
    skip("branch")
      ? []
      : db.branch.findMany({ where: where("branch"), select: { id: true, name: true } }),
    skip("driver")
      ? []
      : db.driver.findMany({ where: where("driver"), select: { id: true, name: true } }),
    skip("vehicle")
      ? []
      : db.vehicle.findMany({
          where: where("vehicle"),
          select: { id: true, vehicleNumber: true },
        }),
    skip("slip")
      ? []
      : db.vendorPaymentSlip.findMany({
          where: where("slip"),
          select: { id: true, slipNumber: true },
        }),
    skip("trip")
      ? []
      : db.vehicleTrip.findMany({ where: where("trip"), select: { id: true, tripNumber: true } }),
    skip("journey")
      ? []
      : db.vehicleJourney.findMany({
          where: where("journey"),
          select: { id: true, journeyNumber: true },
        }),
  ]);

  return new Map<string, string>([
    ...roles.map((r) => [r.id, r.name] as const),
    ...users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()] as const),
    ...branches.map((b) => [b.id, b.name] as const),
    ...drivers.map((d) => [d.id, d.name] as const),
    ...vehicles.map((v) => [v.id, v.vehicleNumber] as const),
    ...slips.map((s) => [s.id, s.slipNumber] as const),
    ...trips.map((t) => [t.id, t.tripNumber] as const),
    ...journeys.map((j) => [j.id, j.journeyNumber] as const),
  ]);
};

// Everyone who has at least one audit entry — feeds the "Changed by" filter.
// Served here (not /admin/users) so audit-only viewers can use it too.
router.get("/actors", async (_req, res) => {
  const rows = await db.auditLog.groupBy({ by: ["actorId"] });
  const actors = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.actorId) } },
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  sendOk(res, actors);
});

router.get("/", async (req, res) => {
  const q = querySchema.parse(req.query);
  const where = {
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(q.from || q.to
      ? {
          createdAt: {
            ...(q.from ? { gte: q.from } : {}),
            ...(q.to ? { lt: q.to } : {}),
          },
        }
      : {}),
  };
  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.size,
      skip: (q.page - 1) * q.size,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const labels = await resolveRefLabels(items);
  const withRefs = items.map((item) => ({
    ...item,
    // Only the ids this entry mentions. Ids that no longer resolve (e.g. a
    // deleted role) are simply absent — the client falls back gracefully.
    refs: Object.fromEntries(
      referencedIds(item).flatMap(([, id]) => {
        const label = labels.get(id);
        return label ? [[id, label]] : [];
      }),
    ),
  }));

  sendOk(res, withRefs, { total, page: q.page, size: q.size });
});

export default router;
