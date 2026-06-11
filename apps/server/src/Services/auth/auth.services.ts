import bcrypt from "bcryptjs";
import { db } from "../../../prisma/prisma.js";
import { InvalidCredentialsError } from "../../lib/error.js";
import {
  generateAccessToken,
  generateRefreshToken,
  ROLES,
} from "../../util/auth.util.js";
import { AuthUser, AppKind } from "@skerp/types";
export const createSession = async (user: AuthUser, appKind: AppKind) => {
  if (!user.role) {
    throw new Error("User role missing");
  }
  const payload = {
    userId: user.id,
    email: user.email,
    appKind,
    role: user.role.name,
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { accessToken, refreshToken };
};

const assertValidPasswordLogin = async (email: string, password: string) => {
  const user = await db.user.findUnique({
    where: { email },
    include: {
      role: true,
    },
  });

  if (!user) {
    throw new InvalidCredentialsError("Invalid email or password");
  }

  if (!user.role) {
    throw new InvalidCredentialsError("Role not assigned");
  }

  if (!user.password) {
    throw new InvalidCredentialsError("Password not set");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new InvalidCredentialsError("Invalid email or password");
  }

  if (!user.status) {
    throw new InvalidCredentialsError("Account is deactivated");
  }

  return user;
};

const appKindForRole = (role: {
  name: string;
  isSystem?: boolean | null;
}): AppKind =>
  role.isSystem || role.name === ROLES.ADMIN ? "admin" : "employee";

export const webLoginService = async (email: string, password: string) => {
  const user = await assertValidPasswordLogin(email, password);
  const { password: _, ...safeUser } = user;
  const session = await createSession(user, appKindForRole(user.role));

  return {
    user: safeUser,
    ...session,
  };
};
export const adminLoginService = async (email: string, password: string) => {
  const user = await db.user.findUnique({
    where: { email },
    include: {
      role: true,
    },
  });

  if (!user) {
    throw new InvalidCredentialsError("Invalid email or password");
  }

  if (user.role?.name !== ROLES.ADMIN) {
    throw new InvalidCredentialsError("Unauthorized access");
  }

  if (!user.password) {
    throw new InvalidCredentialsError("Password not set");
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    throw new InvalidCredentialsError("Invalid email or password");
  }

  if (!user.status) {
    throw new InvalidCredentialsError("Account is deactivated");
  }

  const { password: _, ...safeUser } = user;

  const session = await createSession(user, "admin");

  return {
    user: safeUser,
    ...session,
  };
};
export const getMeService = async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
    },
  });

  if (!user) {
    return null;
  }

  const { password: _, ...safeUser } = user;
  return safeUser;
};

export const employeeLoginService = async (email: string, password: string) => {
  const user = await db.user.findUnique({
    where: { email },
    include: {
      role: true,
    },
  });

  if (!user || user.role?.name !== ROLES.EMPLOYEE) {
    throw new InvalidCredentialsError("Invalid employee credentials");
  }
  if (!user.password) {
    throw new InvalidCredentialsError("Password not set");
  }

  const valid = await bcrypt.compare(password, user.password!);
  if (!valid) throw new InvalidCredentialsError("Invalid password");

  if (!user.status) {
    throw new InvalidCredentialsError("Account is deactivated");
  }

  const session = await createSession(user, "employee");

  const { password: _, ...safeUser } = user;

  return {
    user: safeUser,
    ...session,
  };
};
