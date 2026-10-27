/**
 * In-app feedback — TESTING PHASE ONLY (Jira label `remove-before-prod`).
 *
 * Build-time switch: with NEXT_PUBLIC_FEEDBACK_ENABLED unset/false the widget
 * renders nothing and its sheet chunk is never requested. The server has its
 * own runtime switch (FEEDBACK_ENABLED); if that is off, GET /feedback/status
 * 404s and the widget hides itself without a web rebuild.
 */
export const FEEDBACK_ENABLED =
  process.env.NEXT_PUBLIC_FEEDBACK_ENABLED === "true";
