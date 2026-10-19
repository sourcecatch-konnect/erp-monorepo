import { Router } from "express";
import type {
  MyWorkResponse,
  MyWorkRowsResponse,
  MyWorkScope,
} from "@skerp/types";

import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { sendError, sendOk } from "../_shared/response.js";
import { GOING_ON, QUEUE_BY_KEY, QUEUES } from "./queues.js";

/**
 * "My Work" — a live worklist. Every queue is a status/age rule over the
 * existing tables, filtered by the viewer's permissions and branch scope.
 * Nothing is stored here; the numbers are always the ERP's current state.
 */
const router: Router = Router();
router.use(authMiddleware);

const DO_TODAY_LIMIT = 10;
const PAGE_SIZE = 20;

router.get("/", async (req, res) => {
  const perms = req.ctx?.permissions;
  if (!perms) {
    return sendError(res, 401, {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  const now = new Date();

  const allowed = QUEUES.filter((q) => perms.has(q.permission));
  const allowedGoingOn = GOING_ON.filter((g) => perms.has(g.permission));

  const [summaries, goingOnCounts] = await Promise.all([
    Promise.all(allowed.map((q) => q.summarise(req, now))),
    Promise.all(allowedGoingOn.map((g) => g.count(req))),
  ]);

  // Hide queues with nothing in them at all — an empty card is noise. The
  // page shows an "all caught up" state when every queue is empty.
  const queues = summaries.filter((q) => q.waiting > 0 || q.stale > 0);

  const doToday = queues
    .flatMap((q) =>
      q.rows
        .filter((r) => r.isLate)
        .map((r) => ({
          ...r,
          queueKey: q.key,
          actionLabel: q.actionLabel,
          score: r.ageDays / q.lateAfterDays,
        })),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, DO_TODAY_LIMIT)
    .map(({ score: _score, ...row }) => row);

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
      stale: queues.reduce((n, q) => n + q.stale, 0),
      goingOn: goingOn.reduce((n, g) => n + g.count, 0),
    },
    doToday,
    queues,
    goingOn,
  };
  return sendOk(res, body);
});

/** Next page of one queue — powers "Show more" and the Stale tab. */
router.get("/:queue", async (req, res) => {
  const queue = QUEUE_BY_KEY.get(req.params.queue as never);
  if (!queue) {
    return sendError(res, 404, {
      code: "NOT_FOUND",
      message: "Unknown queue",
    });
  }
  if (!req.ctx?.permissions.has(queue.permission)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden" });
  }

  const scope: MyWorkScope = req.query.scope === "stale" ? "stale" : "active";
  const skip = Math.max(0, Number.parseInt(String(req.query.skip ?? "0"), 10) || 0);

  const { rows, total } = await queue.page(
    req,
    scope,
    skip,
    PAGE_SIZE,
    new Date(),
  );
  const body: MyWorkRowsResponse = {
    rows,
    remaining: Math.max(0, total - skip - rows.length),
  };
  return sendOk(res, body);
});

export default router;
