import bcrypt from "bcryptjs";
import type { EmployeePageQuery } from "@skerp/validators";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import { invalidateUser } from "../../auth/permission-cache.js";
import { recordAuditEntry } from "../../modules/audit/audit.service.js";

const SALT_ROUNDS = 10;

/** Full shape for the detail dialog. Selected, so the password hash is never read. */
const employeeSelect = {
  id: true,
  userName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  companyId: true,
  branchId: true,
  roleId: true,
  status: true,
  mobile: true,
  whatsappOptIn: true,
  emailOptIn: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

/** Only what a list row shows. */
const employeeListSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  status: true,
  role: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

const isPrismaError = (err: unknown, code: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

/** Run an update/delete by id, turning "no such row" into a 404. */
const orNotFound = async <T>(work: Promise<T>): Promise<T> => {
  try {
    return await work;
  } catch (err) {
    if (isPrismaError(err, "P2025")) throw new NotFoundError("User not found");
    throw err;
  }
};

const fullName = (u: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) => [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ");

/** Derive a unique userName from the email local-part, in one query. */
const deriveUserName = async (email: string): Promise<string> => {
  const base =
    (email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "user";
  const taken = new Set(
    (
      await db.user.findMany({
        where: { userName: { startsWith: base } },
        select: { userName: true },
      })
    ).map((u) => u.userName),
  );
  let candidate = base;
  for (let suffix = 1; taken.has(candidate); suffix += 1) {
    candidate = `${base}${suffix}`;
  }
  return candidate;
};

/**
 * Refuse a change that would leave nobody on the built-in Admin role able to
 * sign in, which would lock everyone out of user and role management.
 */
const assertAnotherActiveAdmin = async (userId: string) => {
  const others = await db.user.count({
    where: { id: { not: userId }, status: true, role: { isSystem: true } },
  });
  if (others === 0) {
    throw new ConflictError(
      "This is the only active admin. Make someone else an admin first, or nobody will be able to manage users.",
    );
  }
};

type UserReference = { table: string; column: string };
let userReferences: Promise<UserReference[]> | undefined;

/**
 * Every column that points at User and keeps history: RESTRICT ones would
 * block a delete, SET NULL ones would silently blank "created/approved by".
 * CASCADE ones (the user's own permissions, branches, notifications, prefs)
 * go with the user. Read once from the Postgres catalog.
 */
const loadUserReferences = () =>
  (userReferences ??= db.$queryRaw<UserReference[]>`
    SELECT c.conrelid::regclass::text AS "table",
           quote_ident(a.attname) AS "column"
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = '"User"'::regclass
      AND c.confdeltype <> 'c'
  `.catch((err: unknown) => {
    userReferences = undefined;
    throw err;
  }));

/** One round-trip: does anything recorded in the system point at this user? */
const hasHistory = async (userId: string): Promise<boolean> => {
  const refs = await loadUserReferences();
  if (refs.length === 0) return false;
  // Identifiers come from the catalog (already quoted); the id is a bound $1.
  const sql = `SELECT ${refs
    .map((r) => `EXISTS (SELECT 1 FROM ${r.table} WHERE ${r.column} = $1)`)
    .join(" OR ")} AS "used"`;
  const [row] = await db.$queryRawUnsafe<{ used: boolean }[]>(sql, userId);
  return row?.used ?? false;
};

export type CreateEmployeeArgs = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  companyId: string;
  branchId: string;
  roleId: string;
};

export const createEmployeeService = async (args: CreateEmployeeArgs) => {
  // Independent checks in parallel. A branch that belongs to the company
  // also proves the company exists.
  const [emailTaken, branch, role, userName] = await Promise.all([
    db.user.findUnique({ where: { email: args.email }, select: { id: true } }),
    db.branch.findUnique({
      where: { id: args.branchId },
      select: { companyId: true },
    }),
    db.role.findUnique({ where: { id: args.roleId }, select: { id: true } }),
    deriveUserName(args.email),
  ]);
  if (emailTaken) {
    throw new ConflictError("A user with this email already exists");
  }
  if (!branch || branch.companyId !== args.companyId) {
    throw new NotFoundError("Branch not found for the selected company");
  }
  if (!role) throw new NotFoundError("Role not found");

  return db.user.create({
    data: {
      userName,
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      email: args.email,
      companyId: args.companyId,
      branchId: args.branchId,
      roleId: args.roleId,
      status: true,
      password: await bcrypt.hash(args.password, SALT_ROUNDS),
    },
    select: employeeSelect,
  });
};

/** Every user, lean. Used by pickers such as notification recipients. */
export const listEmployeesService = () =>
  db.user.findMany({
    select: employeeListSelect,
    orderBy: { createdAt: "desc" },
  });

/** One database page of users; each search word must match a name, email or username. */
export const listEmployeesPageService = async (query: EmployeePageQuery) => {
  const words = (query.search ?? "").split(/\s+/).filter(Boolean);
  const where: Prisma.UserWhereInput = words.length
    ? {
        AND: words.map((word) => ({
          OR: [
            { firstName: { contains: word, mode: "insensitive" } },
            { middleName: { contains: word, mode: "insensitive" } },
            { lastName: { contains: word, mode: "insensitive" } },
            { email: { contains: word, mode: "insensitive" } },
            { userName: { contains: word, mode: "insensitive" } },
          ],
        })),
      }
    : {};
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: query.page * query.size,
      take: query.size,
      select: employeeListSelect,
    }),
    db.user.count({ where }),
  ]);
  return { items, total };
};

export const getEmployeeService = async (id: string) => {
  const user = await db.user.findUnique({
    where: { id },
    select: employeeSelect,
  });
  if (!user) throw new NotFoundError("User not found");
  return user;
};

export type UpdateEmployeeArgs = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  roleId?: string;
  mobile?: string | null;
  companyId?: string;
  branchId?: string;
  whatsappOptIn?: boolean;
  emailOptIn?: boolean;
};

export const updateEmployeeService = async (
  id: string,
  args: UpdateEmployeeArgs,
) => {
  const existing = await db.user.findUnique({
    where: { id },
    select: {
      companyId: true,
      branchId: true,
      roleId: true,
      status: true,
      role: { select: { isSystem: true } },
    },
  });
  if (!existing) throw new NotFoundError("User not found");

  const companyId = args.companyId ?? existing.companyId;
  const branchId = args.branchId ?? existing.branchId;
  const placementChanging = Boolean(args.companyId || args.branchId);
  const roleChanging = Boolean(args.roleId && args.roleId !== existing.roleId);

  const [emailTaken, branch, role] = await Promise.all([
    args.email
      ? db.user.findFirst({
          where: { email: args.email, NOT: { id } },
          select: { id: true },
        })
      : null,
    placementChanging
      ? db.branch.findUnique({
          where: { id: branchId },
          select: { companyId: true },
        })
      : null,
    roleChanging && args.roleId
      ? db.role.findUnique({
          where: { id: args.roleId },
          select: { isSystem: true },
        })
      : null,
  ]);
  if (emailTaken) {
    throw new ConflictError("A user with this email already exists");
  }
  if (placementChanging && (!branch || branch.companyId !== companyId)) {
    throw new NotFoundError("Branch not found for the selected company");
  }
  if (roleChanging && !role) throw new NotFoundError("Role not found");
  if (
    roleChanging &&
    existing.status &&
    existing.role.isSystem &&
    !role?.isSystem
  ) {
    await assertAnotherActiveAdmin(id);
  }

  const user = await db.user.update({
    where: { id },
    data: {
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      email: args.email,
      roleId: args.roleId,
      mobile: args.mobile,
      companyId: args.companyId,
      branchId: args.branchId,
      whatsappOptIn: args.whatsappOptIn,
      emailOptIn: args.emailOptIn,
      ...(args.branchId
        ? {
            userBranches: {
              ...(args.branchId !== existing.branchId
                ? { deleteMany: { branchId: existing.branchId } }
                : {}),
              upsert: {
                where: { userId_branchId: { userId: id, branchId } },
                create: { branchId },
                update: {},
              },
            },
          }
        : {}),
    },
    select: employeeSelect,
  });
  // Role and branch feed the cached permission context.
  if (roleChanging || (args.branchId && args.branchId !== existing.branchId)) {
    invalidateUser(id);
  }
  return user;
};

export const resetEmployeePasswordService = async (
  id: string,
  password: string,
) =>
  orNotFound(
    db.user.update({
      where: { id },
      data: { password: await bcrypt.hash(password, SALT_ROUNDS) },
      select: employeeSelect,
    }),
  );

export const updateEmployeeStatusService = async (
  id: string,
  status: boolean,
  actorId: string,
) => {
  if (!status && id === actorId) {
    throw new BadRequestError("You can't deactivate your own account.");
  }
  const target = await db.user.findUnique({
    where: { id },
    select: { status: true, role: { select: { isSystem: true } } },
  });
  if (!target) throw new NotFoundError("User not found");
  if (!status && target.status && target.role.isSystem) {
    await assertAnotherActiveAdmin(id);
  }
  const user = await orNotFound(
    db.user.update({ where: { id }, data: { status }, select: employeeSelect }),
  );
  // Takes effect on their very next request, not after the cache expires.
  invalidateUser(id);
  if (target.status !== status) {
    await recordAuditEntry({
      actor: { id: actorId },
      action: "user.status.update",
      entity: "User",
      entityId: id,
      before: { status: target.status },
      after: { status, name: fullName(user) },
    });
  }
  return user;
};

export const deleteEmployeeService = async (id: string, actorId: string) => {
  if (id === actorId) {
    throw new BadRequestError("You can't delete your own account.");
  }
  const target = await db.user.findUnique({
    where: { id },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      status: true,
      role: { select: { name: true, isSystem: true } },
    },
  });
  if (!target) throw new NotFoundError("User not found");
  const name = fullName(target);

  const [used] = await Promise.all([
    hasHistory(id),
    target.status && target.role.isSystem ? assertAnotherActiveAdmin(id) : null,
  ]);
  if (used) {
    throw new ConflictError(
      `${name} has work recorded in the system, so they can't be deleted. Deactivate them instead to stop them signing in.`,
    );
  }

  try {
    await orNotFound(db.user.delete({ where: { id } }));
  } catch (err) {
    // Something referenced them after the check above.
    if (isPrismaError(err, "P2003")) {
      throw new ConflictError(
        `${name} has work recorded in the system, so they can't be deleted. Deactivate them instead to stop them signing in.`,
      );
    }
    throw err;
  }
  invalidateUser(id);
  await recordAuditEntry({
    actor: { id: actorId },
    action: "user.delete",
    entity: "User",
    entityId: id,
    before: { name, email: target.email, roleName: target.role.name },
  });
  return { id };
};
