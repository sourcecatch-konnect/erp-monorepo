import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError } from "../../lib/error.js";
import { sendPasswordResetEmail } from "../email/email.services.js";

const SALT_ROUNDS = 10;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TOKEN_TTL_LABEL = "30 minutes";

const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

const buildResetUrl = (rawToken: string): string => {
  const base = process.env.WEB_URL || "http://localhost:3001";
  return `${base}/reset-password?token=${rawToken}`;
};

/**
 * Starts the forgot-password flow for `rawEmail`.
 *
 * Deliberately returns `void` and never signals whether the address is
 * registered — the caller always responds with the same generic message so an
 * attacker can't enumerate accounts.
 */
export const requestPasswordResetService = async (
  rawEmail: string
): Promise<void> => {
  const email = rawEmail.trim();

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  // Unknown address or a deactivated account: do nothing, silently.
  if (!user || !user.status) return;

  // Spend any earlier unused tokens so only the newest link works.
  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  await sendPasswordResetEmail({
    to: user.email,
    name: user.firstName,
    resetUrl: buildResetUrl(rawToken),
    expiresIn: TOKEN_TTL_LABEL,
  });
};

/**
 * Completes the flow: validates the emailed token and sets the new password.
 * The token is single-use — it's marked spent in the same transaction as the
 * password write.
 */
export const resetPasswordService = async (
  rawToken: string,
  newPassword: string
): Promise<void> => {
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw new BadRequestError(
      "This reset link is invalid or has expired. Please request a new one.",
      "RESET_TOKEN_INVALID"
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await db.$transaction([
    db.user.update({
      where: { id: row.userId },
      data: { password: passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);
};
