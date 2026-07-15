import bcrypt from "bcryptjs";
import { db } from "../../../prisma/prisma.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import { invalidateUser } from "../../auth/permission-cache.js";

const SALT_ROUNDS = 10;

/** Shape returned to clients — never includes the password hash. */
const employeeInclude = {
  role: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

const toSafeEmployee = <T extends { password: string | null }>(
  user: T
) => {
  const { password: _password, ...safe } = user;
  return safe;
};

/** Derive a unique userName from the email local-part. */
const deriveUserName = async (email: string): Promise<string> => {
  const base =
    (email.split("@")[0] ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "user";

  let candidate = base;
  let suffix = 1;
  while (await db.user.findUnique({ where: { userName: candidate } })) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
};

/** Load a managed user by id. */
const getEmployeeOrThrow = async (id: string) => {
  const user = await db.user.findUnique({
    where: { id },
    include: employeeInclude,
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user;
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
  const emailTaken = await db.user.findUnique({
    where: { email: args.email },
  });
  if (emailTaken) {
    throw new ConflictError("A user with this email already exists");
  }

  const company = await db.company.findUnique({
    where: { id: args.companyId },
  });
  if (!company) throw new NotFoundError("Company not found");

  const branch = await db.branch.findUnique({
    where: { id: args.branchId },
  });
  if (!branch || branch.companyId !== args.companyId) {
    throw new NotFoundError("Branch not found for the selected company");
  }

  if (!args.roleId) {
    throw new BadRequestError("Role is required");
  }

  const role = await db.role.findUnique({ where: { id: args.roleId } });
  if (!role) throw new NotFoundError("Role not found");

  const userName = await deriveUserName(args.email);
  const passwordHash = await bcrypt.hash(args.password, SALT_ROUNDS);

  const user = await db.user.create({
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
      password: passwordHash,
    },
    include: employeeInclude,
  });

  return toSafeEmployee(user);
};

export const listEmployeesService = async () => {
  const employees = await db.user.findMany({
    include: employeeInclude,
    orderBy: { createdAt: "desc" },
  });
  return employees.map(toSafeEmployee);
};

export const getEmployeeService = async (id: string) => {
  return toSafeEmployee(await getEmployeeOrThrow(id));
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
  args: UpdateEmployeeArgs
) => {
  const existing = await getEmployeeOrThrow(id);

  if (args.email) {
    const emailTaken = await db.user.findFirst({
      where: { email: args.email, NOT: { id } },
    });
    if (emailTaken) {
      throw new ConflictError("A user with this email already exists");
    }
  }

  const companyId = args.companyId ?? existing.companyId;
  const branchId = args.branchId ?? existing.branchId;

  if (args.companyId) {
    const company = await db.company.findUnique({
      where: { id: args.companyId },
    });
    if (!company) throw new NotFoundError("Company not found");
  }

  if (args.companyId || args.branchId) {
    const branch = await db.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch || branch.companyId !== companyId) {
      throw new NotFoundError("Branch not found for the selected company");
    }
  }

  if (args.roleId) {
    const role = await db.role.findUnique({ where: { id: args.roleId } });
    if (!role) throw new NotFoundError("Role not found");
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
    include: employeeInclude,
  });
  if (args.roleId && args.roleId !== existing.roleId) {
    invalidateUser(id);
  }
  return toSafeEmployee(user);
};

export const resetEmployeePasswordService = async (
  id: string,
  password: string
) => {
  await getEmployeeOrThrow(id);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await db.user.update({
    where: { id },
    data: { password: passwordHash },
    include: employeeInclude,
  });
  return toSafeEmployee(user);
};

export const updateEmployeeStatusService = async (
  id: string,
  status: boolean
) => {
  await getEmployeeOrThrow(id);
  const user = await db.user.update({
    where: { id },
    data: { status },
    include: employeeInclude,
  });
  return toSafeEmployee(user);
};
