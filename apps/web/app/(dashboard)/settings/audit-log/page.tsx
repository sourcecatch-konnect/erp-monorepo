import { ProtectedRoute } from "@/features/auth";
import { AuditLogPage } from "@/features/rbac";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ADMIN.AUDIT_LOG_VIEW}>
      <AuditLogPage />
    </ProtectedRoute>
  );
}
