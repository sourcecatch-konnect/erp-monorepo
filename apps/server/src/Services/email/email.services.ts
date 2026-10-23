import {
  SendEmailCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

type EmployeeCredentialsEmail = {
  to: string;
  name: string;
  loginEmail: string;
  password: string;
  loginUrl: string;
};

/** SES is considered configured once a region is provided. */
const sesConfigured = (): boolean => Boolean(process.env.AWS_REGION);

/**
 * Builds an SESv2 client. Explicit access keys are used when present
 * (local dev); otherwise the AWS default credential provider chain is
 * used so an IAM role works in production with no static secrets.
 */
const buildClient = (): SESv2Client => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  return new SESv2Client({
    region: process.env.AWS_REGION,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
};

/**
 * Sends an employee their login credentials via Amazon SES.
 *
 * Best-effort: returns `false` (and logs) instead of throwing when SES is
 * not configured or the send fails — so employee creation / password reset
 * never fails because of email. The SES sender identity used in MAIL_FROM
 * must be a verified domain or address.
 */
export const sendEmployeeCredentialsEmail = async (
  args: EmployeeCredentialsEmail
): Promise<boolean> => {
  const subject = "Your SK Translines ERP account";
  const text = [
    `Hi ${args.name},`,
    ``,
    `An account has been created for you on the SK Translines ERP.`,
    ``,
    `Login URL: ${args.loginUrl}`,
    `Email:     ${args.loginEmail}`,
    `Password:  ${args.password}`,
    ``,
    `Please keep these credentials safe and change your password after`,
    `your first login if prompted.`,
  ].join("\n");

  if (!sesConfigured()) {
    console.info(
      `[email] Amazon SES not configured (AWS_REGION unset) — ` +
        `credentials email NOT sent.\n` +
        `--- would send to ${args.to} ---\n${subject}\n${text}\n---`
    );
    return false;
  }

  const from = process.env.MAIL_FROM;
  if (!from) {
    console.error(
      "[email] MAIL_FROM is not set — cannot send credentials email."
    );
    return false;
  }

  try {
    const client = buildClient();
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [args.to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: { Text: { Data: text, Charset: "UTF-8" } },
          },
        },
      })
    );
    return true;
  } catch (err) {
    console.error(
      "[email] Failed to send credentials email via SES:",
      err
    );
    return false;
  }
};

type PasswordResetEmail = {
  to: string;
  name: string;
  resetUrl: string;
  /** Human-readable link lifetime, e.g. "30 minutes". */
  expiresIn: string;
};

/**
 * Sends a password-reset link via Amazon SES.
 *
 * Best-effort, exactly like {@link sendEmployeeCredentialsEmail}: returns
 * `false` (and logs the would-be email) when SES is not configured or the send
 * fails, so the forgot-password endpoint never leaks whether an address exists
 * by succeeding/failing differently.
 */
export const sendPasswordResetEmail = async (
  args: PasswordResetEmail
): Promise<boolean> => {
  const subject = "Reset your SK Translines ERP password";
  const text = [
    `Hi ${args.name},`,
    ``,
    `We received a request to reset the password for your SK Translines ERP`,
    `account.`,
    ``,
    `Reset your password (link valid for ${args.expiresIn}):`,
    args.resetUrl,
    ``,
    `If you didn't request this, you can ignore this email — your password`,
    `will not change.`,
  ].join("\n");

  if (!sesConfigured()) {
    console.info(
      `[email] Amazon SES not configured (AWS_REGION unset) — ` +
        `password reset email NOT sent.\n` +
        `--- would send to ${args.to} ---\n${subject}\n${text}\n---`
    );
    return false;
  }

  const from = process.env.MAIL_FROM;
  if (!from) {
    console.error(
      "[email] MAIL_FROM is not set — cannot send password reset email."
    );
    return false;
  }

  try {
    const client = buildClient();
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [args.to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: { Text: { Data: text, Charset: "UTF-8" } },
          },
        },
      })
    );
    return true;
  } catch (err) {
    console.error(
      "[email] Failed to send password reset email via SES:",
      err
    );
    return false;
  }
};
