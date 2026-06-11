import { ProtectedRoute } from "@/features/auth";
import { RolesPage } from "@/features/rbac";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ADMIN.RBAC_MANAGE}>
      <RolesPage />
    </ProtectedRoute>
  );
}
