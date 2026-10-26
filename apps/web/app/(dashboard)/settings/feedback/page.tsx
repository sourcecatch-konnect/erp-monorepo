import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { FEEDBACK_ENABLED, FeedbackAdminPage } from "@/features/feedback";
import { PERMS } from "@skerp/types";

// remove-before-prod: in-app feedback admin (testing phase only).
export default function Page() {
  if (!FEEDBACK_ENABLED) notFound();
  return (
    <ProtectedRoute permission={PERMS.FEEDBACK.VIEW}>
      <FeedbackAdminPage />
    </ProtectedRoute>
  );
}
