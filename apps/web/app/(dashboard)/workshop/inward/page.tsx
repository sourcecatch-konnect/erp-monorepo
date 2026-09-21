import { ProtectedRoute } from "@/features/auth";
import { SpareInwardListPage } from "@/features/spare-inward";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.INWARD_VIEW}>
      <SpareInwardListPage />
    </ProtectedRoute>
  );
}
