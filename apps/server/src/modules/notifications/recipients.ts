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

/**
 * Active users holding a permission, optionally limited to a branch. Mirrors
 * resolvePermissions: a system role has everything; otherwise a role or user
 * GRANT counts unless the user has a DENY.
 */
const permissionUsersForBranch = async (
  permissionKey: string,
  branchId?: string | null,
) => {
  const permission = { permission: { key: permissionKey } };
  const users = await db.user.findMany({
    where: {
      status: true,
      AND: [
        ...(branchId
          ? [
              {
                OR: [
                  { branchId },
                  { userBranches: { some: { branchId } } },
                  { branchScope: "ALL" as const },
                ],
              },
            ]
          : []),
        {
          OR: [
            { role: { isSystem: true } },
            {
              AND: [
                {
                  OR: [
                    { role: { rolePermissions: { some: permission } } },
                    { userPermissions: { some: { effect: "GRANT" as const, ...permission } } },
                  ],
                },
                { userPermissions: { none: { effect: "DENY" as const, ...permission } } },
              ],
            },
          ],
        },
      ],
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
};

/** Token after the @ in a resolver key: fromBranch / toBranch read the payload;
 *  anything else (branch, eventBranch, none) is the event's branch. */
const branchForToken = (branchToken: string | undefined, input: ResolverInput) =>
  branchToken === "fromBranch"
    ? payloadString(input.payload, "fromBranchId")
    : branchToken === "toBranch"
      ? payloadString(input.payload, "toBranchId")
      : input.branchId;

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
    const branchId = branchForToken(branchToken, input);

    return unique(roleName ? await roleUsersForBranch(roleName, branchId) : []);
  }

  // permission:<key>@branch — e.g. permission:claim.update@branch
  if (resolverKey.startsWith("permission:")) {
    const [permissionKey, branchToken] = resolverKey.slice("permission:".length).split("@");
    return unique(
      permissionKey
        ? await permissionUsersForBranch(permissionKey, branchForToken(branchToken, input))
        : [],
    );
  }

  const resolver = resolvers[resolverKey];
  if (!resolver) {
    console.warn(`[notifications] Unknown recipient resolver: ${resolverKey}`);
    return [];
  }

  return unique(await resolver(input));
};
