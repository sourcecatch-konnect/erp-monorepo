/**
 * Which copy of the ERP this build is (A9). Set NEXT_PUBLIC_APP_ENVIRONMENT
 * to "training" on the training deployment only (the server has its own
 * APP_ENVIRONMENT). Build-time: Next inlines it.
 */
export const IS_TRAINING_ENVIRONMENT =
  process.env.NEXT_PUBLIC_APP_ENVIRONMENT === "training";
