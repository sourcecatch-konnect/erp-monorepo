import bcrypt from "bcryptjs";
import { db } from "../../../prisma/prisma.js";
import { InvalidCredentialsError } from "../../lib/error.js";
import { generateAccessToken, generateRefreshToken, ROLES } from "../../util/auth.util.js";
import { AuthUser,AppKind } from "@skerp/types";
export const createSession = async (
  user: AuthUser,
  appKind: AppKind
) => {
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
export const adminLoginService = async (
  email: string,
  password: string
) => {
  const user = await db.user.findUnique({
    where: { email },
    include: {
      role: true,
    },
  });

  if (!user) {
    throw new InvalidCredentialsError(
      "Invalid email or password"
    );
  }

  if (user.role?.name !== ROLES.ADMIN) {
    throw new InvalidCredentialsError(
      "Unauthorized access"
    );
  }

  if (!user.password) {
    throw new InvalidCredentialsError(
      "Password not set"
    );
  }

  const valid = await bcrypt.compare(
    password,
    user.password
  );

  if (!valid) {
    throw new InvalidCredentialsError(
      "Invalid email or password"
    );
  }

  const { password: _, ...safeUser } = user;

  const session = await createSession(
    user,
    "admin"
  );

  return {
    user: safeUser,
    ...session,
  };
};
export const employeeLoginService = async (email: string, password: string) => {
  const user = await db.user.findUnique({
  where: { email },
  include: {
    role: true,
  },
});

if (!user || user.role?.name !== ROLES.EMPLOYEE) {
  throw new InvalidCredentialsError(
    "Invalid employee credentials"
  );
}
if (!user.password) {
  throw new InvalidCredentialsError("Password not set");
}

  const valid = await bcrypt.compare(password, user.password!);
  if (!valid) throw new InvalidCredentialsError("Invalid password");

  const session = await createSession(user, "employee");

  const { password: _, ...safeUser } = user;

  return {
    user: safeUser,
    ...session,
  };
};
