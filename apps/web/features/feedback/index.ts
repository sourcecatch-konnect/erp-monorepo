/**
 * In-app feedback — TESTING PHASE ONLY (Jira label `remove-before-prod`).
 *
 * Public API. Only two places may import this feature (enforced by ESLint):
 *   - components/layout/AppShell.tsx       → <FeedbackLauncher />
 *   - app/(dashboard)/settings/feedback/    → <FeedbackAdminPage />
 * Removing the feature = delete this folder + those two touch points.
 */
export { FeedbackLauncher } from "./components/FeedbackLauncher";
export { FeedbackAdminPage } from "./admin/FeedbackAdminPage";
export { FEEDBACK_ENABLED } from "./feedback.flag";
