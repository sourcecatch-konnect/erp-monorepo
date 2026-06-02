import { db } from "../../../prisma/prisma.js";
import type { NotificationPayload } from "./types.js";

type ResolverInput = {
  branchId?: string | null;
  actorId?: string | null;
  payload: NotificationPayload;
};

type RecipientResolver = (input: ResolverInput) => Promise<string[]>;

const unique = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

const payloadString = (payload: NotificationPayload, key: string) => {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
};

const usersForBranch = async (branchId: string) => {
  const users = await db.user.findMany({
    where: {
      status: true,
      OR: [
        { branchId },
        { userBranches: { some: { branchId } } },
        { branchScope: "ALL" },
      ],
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
};

const roleUsersForBranch = async (roleName: string, branchId?: string | null) => {
  const users = await db.user.findMany({
    where: {
      status: true,
      role: { name: roleName },
      ...(branchId
        ? {
            OR: [
              { branchId },
              { userBranches: { some: { branchId } } },
              { branchScope: "ALL" },
            ],
          }
        : {}),
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
};

const resolvers: Record<string, RecipientResolver> = {
  actor: async ({ actorId }) => (actorId ? [actorId] : []),
  "order.creator": async ({ payload }) => {
    const userId = payloadString(payload, "createdById") || payloadString(payload, "orderCreatorId");
    return userId ? [userId] : [];
  },
  "lr.creator": async ({ payload }) => {
    const userId = payloadString(payload, "createdById") || payloadString(payload, "lrCreatorId");
    return userId ? [userId] : [];
  },
  "fromBranch.users": async ({ payload, branchId }) => {
    const targetBranchId = payloadString(payload, "fromBranchId") || branchId;
    return targetBranchId ? usersForBranch(targetBranchId) : [];
  },
  "toBranch.users": async ({ payload, branchId }) => {
    const targetBranchId = payloadString(payload, "toBranchId") || branchId;
    return targetBranchId ? usersForBranch(targetBranchId) : [];
  },
  subscribers: async ({ branchId }) => {
    if (!branchId) return [];
    return usersForBranch(branchId);
  },
};

export const resolveRecipients = async (
  resolverKey: string,
  input: ResolverInput
) => {
  if (resolverKey.startsWith("role:")) {
    const [, rest] = resolverKey.split("role:");
    const [roleName, branchToken] = (rest || "").split("@");
    const branchId =
      branchToken === "branch" || branchToken === "eventBranch"
        ? input.branchId
        : branchToken === "fromBranch"
          ? payloadString(input.payload, "fromBranchId")
          : branchToken === "toBranch"
            ? payloadString(input.payload, "toBranchId")
            : input.branchId;

    return unique(roleName ? await roleUsersForBranch(roleName, branchId) : []);
  }

  const resolver = resolvers[resolverKey];
  if (!resolver) {
    console.warn(`[notifications] Unknown recipient resolver: ${resolverKey}`);
    return [];
  }

  return unique(await resolver(input));
};
