/**
 * Which copy of the ERP this server is (A9). Set APP_ENVIRONMENT=training on
 * the training deployment only; anything else is treated as a real system.
 *
 * In the training environment every outbound integration is switched off —
 * no email, WhatsApp, e-way bill portal or GPS calls — so practice data can
 * never reach a customer, a driver or a government system.
 */
export const isTrainingEnvironment = (): boolean =>
  process.env.APP_ENVIRONMENT === "training";

/** Log line used wherever an outbound call is skipped in training. */
export const logOutboundSkipped = (service: string, detail?: string): void => {
  console.info(
    `[training] ${service} is switched off in the training environment${
      detail ? ` — skipped: ${detail}` : ""
    }`,
  );
};
