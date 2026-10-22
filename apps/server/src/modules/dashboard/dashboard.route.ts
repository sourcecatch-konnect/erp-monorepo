import { Router, type Request } from "express";
import { PERMS } from "@skerp/types";
import type { DashboardPeriod, DashboardResponse } from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { ForbiddenError } from "../../lib/error.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { sendError, sendOk } from "../_shared/response.js";
import * as widgets from "./widgets.js";

/**
 * Dashboard — how the business is running. Every figure is an aggregate over
 * existing documents, scoped to the viewer's branches and permissions; a card
 * the viewer may not see comes back null so the page can leave it out rather
 * than print a misleading zero. Nothing is stored.
 */
const router: Router = Router();
router.use(authMiddleware);

const PERIODS: readonly DashboardPeriod[] = [
  "today",
  "week",
  "month",
  "quarter",
];

/**
 * `?branch=<id>` narrows every card to one branch the viewer can already see,
 * by handing the widgets a request whose scope is just that branch. Same
 * approach as My Work.
 */
const forBranch = (req: Request): Request => {
  const branchId = typeof req.query.branch === "string" ? req.query.branch : "";
  const ctx = req.ctx;
  if (!branchId || !ctx) return req;
  if (ctx.branchScope !== "ALL" && !ctx.branchIds.includes(branchId)) {
    throw new ForbiddenError("Branch not in scope");
  }
  const scoped = Object.create(req) as Request;
  scoped.ctx = { ...ctx, branchScope: "ASSIGNED", branchIds: [branchId] };
  return scoped;
};

router.get("/", async (req, res) => {
  const perms = req.ctx?.permissions;
  if (!perms) {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  const period = PERIODS.find((p) => p === req.query.period) ?? "month";
  const now = new Date();
  const { range, ...window } = widgets.resolveRange(period, now);
  const scoped = forBranch(req);

  const can = {
    billing: perms.has(PERMS.BILLING.VIEW),
    receipt: perms.has(PERMS.RECEIPT.VIEW),
    trip: perms.has(PERMS.TRIP.VIEW),
    order: perms.has(PERMS.ORDER.VIEW),
    lr: perms.has(PERMS.LORRY_RECEIPT.VIEW),
    rail: perms.has(PERMS.RAIL_RAKE_OPERATION.VIEW),
    vehicle: perms.has(PERMS.MASTERS.VEHICLE.VIEW),
  };

  // The funnel spans orders, LRs and billing. Showing it with a step the
  // viewer cannot see would read as a drop-off that isn't there, so it needs
  // all three.
  const canSeeFunnel = can.order && can.lr && can.billing;
  const canSeeGlance = can.billing || can.receipt || can.trip;
  const canSeeAttention = can.lr || can.billing || can.rail;

  const [
    revenue,
    glance,
    funnel,
    ageing,
    topCustomers,
    fleet,
    attention,
    branches,
  ] = await Promise.all([
    can.billing ? widgets.revenue(scoped, window, now) : null,
    canSeeGlance ? widgets.glance(scoped, window, now, can) : null,
    canSeeFunnel ? widgets.funnel(scoped, window) : null,
    can.billing ? widgets.ageing(scoped, now) : null,
    can.billing ? widgets.topCustomers(scoped, window) : null,
    can.vehicle ? widgets.fleet() : null,
    canSeeAttention ? widgets.attention(scoped, now, can) : null,
    db.branch.findMany({
      where:
        req.ctx?.branchScope === "ALL"
          ? {}
          : { id: { in: req.ctx?.branchIds ?? [] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const body: DashboardResponse = {
    period,
    range,
    branches,
    revenue,
    glance,
    funnel,
    ageing,
    topCustomers,
    fleet,
    attention,
  };
  return sendOk(res, body);
});

export default router;
