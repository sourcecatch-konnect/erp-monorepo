import { ProtectedRoute } from "@/features/auth";
import { ClaimsListPage } from "@/features/claims";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.CLAIM.VIEW}>
      <ClaimsListPage />
    </ProtectedRoute>
  );
}
