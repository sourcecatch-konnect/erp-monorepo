import { ProtectedRoute } from "@/features/auth";
import { EmployeeList } from "@/features/employees";
import { PERMS } from "@skerp/types";

export default function UsersPage() {
  return (
    <ProtectedRoute permission={PERMS.ADMIN.RBAC_MANAGE}>
      <EmployeeList />
    </ProtectedRoute>
  );
}
