import { Router } from "express";
import { trainingRoleUpdateSchema } from "@skerp/validators";
import { TRAINING_TRACKS } from "@skerp/types";

import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { can } from "../../auth/can.middleware.js";
import { PERMS } from "../../auth/permissions.js";
import { BadRequestError, NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { parseListQuery, type ListQuery } from "../_shared/list.query.js";
import { buildTeamXlsx } from "./training.export.js";
import {
  adminRoleSelect,
  buildTeamRows,
  teamUserSelect,
  toAdminRole,
} from "./training.team.js";

/**
 * A5 — Settings → Training. Mounted under /training/admin by training.route.ts
 * (which already applied authMiddleware).
 */
const router: Router = Router();
router.use(can(PERMS.ADMIN.TRAINING_MANAGE));

const TRACK_KEYS = new Set<string>(TRAINING_TRACKS.map((track) => track.key));
const MAX_EXPORT_USERS = 2_000;

router.get("/roles", async (_req, res) => {
  const roles = await db.role.findMany({
    orderBy: { name: "asc" },
    select: adminRoleSelect,
  });
  return sendOk(res, roles.map(toAdminRole));
});

router.put("/roles/:roleId", async (req, res) => {
  const parsed = trainingRoleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.flatten().fieldErrors);
  }
  const roleId = String(req.params.roleId);
  const { summary, responsibilities, tracks } = parsed.data;
  const unknown = tracks.filter((track) => !TRACK_KEYS.has(track.trackKey));
  if (unknown.length > 0) {
    throw new BadRequestError(`Unknown training: ${unknown.map((t) => t.trackKey).join(", ")}`);
  }
  const role = await db.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) throw new NotFoundError("Role not found");

  const hasProfile = summary !== "" || responsibilities.length > 0;
  await db.$transaction([
    hasProfile
      ? db.trainingRoleProfile.upsert({
          where: { roleId },
          create: { roleId, summary, responsibilities },
          update: { summary, responsibilities },
        })
      : db.trainingRoleProfile.deleteMany({ where: { roleId } }),
    db.trainingRoleTrack.deleteMany({ where: { roleId } }),
    db.trainingRoleTrack.createMany({
      data: tracks.map((track) => ({ roleId, ...track })),
    }),
  ]);

  const updated = await db.role.findUniqueOrThrow({
    where: { id: roleId },
    select: adminRoleSelect,
  });
  return sendOk(res, toAdminRole(updated));
});

router.get("/branches", async (_req, res) => {
  const branches = await db.branch.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return sendOk(res, branches);
});

/** `search` matches name or email; `filter[roleId]`, `filter[branchId]`. */
const teamWhere = (query: ListQuery): Prisma.UserWhereInput => {
  const contains = query.search
    ? { contains: query.search, mode: "insensitive" as const }
    : undefined;
  return {
    status: true,
    ...(query.filter.roleId ? { roleId: query.filter.roleId } : {}),
    ...(query.filter.branchId ? { branchId: query.filter.branchId } : {}),
    ...(contains
      ? {
          OR: [
            { firstName: contains },
            { lastName: contains },
            { email: contains },
            { userName: contains },
          ],
        }
      : {}),
  };
};

const teamOrder: Prisma.UserOrderByWithRelationInput[] = [
  { firstName: "asc" },
  { lastName: "asc" },
];

router.get("/team", async (req, res) => {
  const query = parseListQuery(req);
  const where = teamWhere(query);
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: teamOrder,
      skip: query.page * query.size,
      take: query.size,
      select: teamUserSelect,
    }),
  ]);
  return sendOk(res, await buildTeamRows(users), {
    page: query.page,
    size: query.size,
    total,
  });
});

router.get("/team/export/xlsx", async (req, res) => {
  const query = parseListQuery(req);
  const users = await db.user.findMany({
    where: teamWhere(query),
    orderBy: teamOrder,
    take: MAX_EXPORT_USERS,
    select: teamUserSelect,
  });
  const generatedAt = new Date();
  const xlsx = await buildTeamXlsx(await buildTeamRows(users), generatedAt);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="skerp-training-${generatedAt.toISOString().slice(0, 10)}.xlsx"`,
  );
  return res.send(xlsx);
});

export default router;
