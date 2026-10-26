import { Router, type Request } from "express";
import type {
  MyWorkModule,
  MyWorkPriorityResponse,
  MyWorkCountResponse,
  MyWorkResponse,
  MyWorkScope,
  MyWorkUrgency,
} from "@skerp/types";

import { db } from "../../../prisma/prisma.js";
import { ForbiddenError } from "../../lib/error.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { sendError, sendOk } from "../_shared/response.js";
import { GOING_ON, QUEUES } from "./queues.js";

/**
 * "My Work" — a live worklist. Every queue is a status/age rule over the
 * existing tables, filtered by the viewer's permissions and branch scope.
 * Nothing is stored here; the numbers are always the ERP's current state.
 */
const router: Router = Router();
router.use(authMiddleware);

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;
// Deepest page of the cross-queue ranking we will build (rows fetched per queue).
const MAX_PRIORITY_DEPTH = 300;

/**
 * `?branch=<id>` narrows every queue to one branch the user can already see,
 * by handing the queues a request whose scope is just that branch. Queues
 * whose documents carry no branch (trips, trip expenses, log slips) are not
 * affected.
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
  const now = new Date();
  const scoped = forBranch(req);

  const allowed = QUEUES.filter((q) => perms.has(q.permission));
  const allowedGoingOn = GOING_ON.filter((g) => perms.has(g.permission));

  const [summaries, goingOnCounts, branches] = await Promise.all([
    Promise.all(allowed.map((q) => q.summarise(scoped, now))),
    Promise.all(allowedGoingOn.map((g) => g.count(scoped))),
    // The branches this user may pick in the page's branch filter.
    db.branch.findMany({
      where:
        req.ctx?.branchScope === "ALL" ? {} : { id: { in: req.ctx?.branchIds ?? [] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Every queue the user may act on is returned, even an empty one, so the
  // overview can show a step as "0" instead of dropping it. Cards for empty
  // queues are hidden by the page.
  const queues = summaries;

  const goingOn = allowedGoingOn.map((g, i) => ({
    key: g.key,
    title: g.title,
    href: g.href,
    count: goingOnCounts[i] ?? 0,
  }));

  const body: MyWorkResponse = {
    summary: {
      needsYou: queues.reduce((n, q) => n + q.waiting, 0),
      late: queues.reduce((n, q) => n + q.late, 0),
      veryLate: queues.reduce((n, q) => n + q.veryLate, 0),
      stale: queues.reduce((n, q) => n + q.stale, 0),
      goingOn: goingOn.reduce((n, g) => n + g.count, 0),
    },
    queues,
    goingOn,
    branches,
  };
  return sendOk(res, body);
});

/**
 * Just the number for the sidebar badge, which shows on every screen: one
 * count per queue instead of the full overview.
 */
router.get("/count", async (req, res) => {
  const perms = req.ctx?.permissions;
  if (!perms) {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  const now = new Date();
  const counts = await Promise.all(
    QUEUES.filter((q) => perms.has(q.permission)).map((q) =>
      q.waitingCount(req, now),
    ),
  );
  const body: MyWorkCountResponse = {
    needsYou: counts.reduce((n, c) => n + c, 0),
  };
  return sendOk(res, body);
});

const MODULES: readonly MyWorkModule[] = [
  "orders",
  "lr",
  "rail",
  "billing",
  "accounts",
  "trips",
  "workshop",
];
const URGENCIES: readonly MyWorkUrgency[] = ["all", "late", "near", "ontime"];

/**
 * The My Work list: items from every queue the user can act on, narrowed by
 * work area (`module`), one step (`queue`), urgency, scope (waiting or old
 * leftovers) and an optional search on number or party. Ranked by how far
 * each item is through its step's time limit, most overdue first. Each queue
 * returns its oldest rows first, so taking the first (skip + size) of each is
 * enough to rank the merged page exactly.
 */
router.get("/priority", async (req, res) => {
  const perms = req.ctx?.permissions;
  if (!perms) {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  const area = MODULES.find((m) => m === req.query.module);
  const queueKey = typeof req.query.queue === "string" ? req.query.queue : "";
  const filter = {
    scope: (req.query.scope === "stale" ? "stale" : "active") as MyWorkScope,
    urgency: URGENCIES.find((u) => u === req.query.urgency) ?? "all",
    search:
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, 100)
        : "",
  };
  const skip = Math.max(0, Number.parseInt(String(req.query.skip ?? "0"), 10) || 0);
  const size = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(String(req.query.size ?? ""), 10) || DEFAULT_PAGE_SIZE),
  );
  const need = Math.min(skip + size, MAX_PRIORITY_DEPTH);
  const now = new Date();

  const allowed = QUEUES.filter(
    (q) =>
      perms.has(q.permission) &&
      (!area || q.module === area) &&
      (!queueKey || q.key === queueKey),
  );
  const scoped = forBranch(req);
  const pages = await Promise.all(
    allowed.map((q) => q.band(scoped, filter, 0, need, now)),
  );

  const ranked = pages
    .flatMap((p, i) =>
      p.rows.map((r) => ({
        ...r,
        queueKey: allowed[i]!.key,
        queueTitle: allowed[i]!.title,
        actionLabel: allowed[i]!.actionLabel,
        lateAfterDays: allowed[i]!.lateAfter,
        score: r.ageDays / allowed[i]!.lateAfter,
      })),
    )
    .sort((a, b) => b.score - a.score)
    .slice(skip, skip + size)
    .map(({ score: _score, ...row }) => row);

  const body: MyWorkPriorityResponse = {
    rows: ranked,
    total: pages.reduce((n, p) => n + p.total, 0),
  };
  return sendOk(res, body);
});

export default router;
