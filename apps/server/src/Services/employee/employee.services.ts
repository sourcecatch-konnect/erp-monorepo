import bcrypt from "bcryptjs";
import { db } from "../../../prisma/prisma.js";
import { ROLES } from "../../util/auth.util.js";
import {
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";

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

/** Find (or lazily create) the "Employee" role. Role.name is not unique. */
const ensureEmployeeRole = async () => {
  const existing = await db.role.findFirst({
    where: { name: ROLES.EMPLOYEE },
  });
  if (existing) return existing;
  return db.role.create({ data: { name: ROLES.EMPLOYEE } });
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

/** Load an employee by id, asserting it exists and has the Employee role. */
const getEmployeeOrThrow = async (id: string) => {
  const user = await db.user.findUnique({
    where: { id },
    include: employeeInclude,
  });
  if (!user || user.role?.name !== ROLES.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
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

  const role = await ensureEmployeeRole();
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
      roleId: role.id,
      status: true,
      password: passwordHash,
    },
    include: employeeInclude,
  });

  return toSafeEmployee(user);
};

export const listEmployeesService = async () => {
  const employees = await db.user.findMany({
    where: { role: { name: ROLES.EMPLOYEE } },
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

  const user = await db.user.update({
    where: { id },
    data: {
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      email: args.email,
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
