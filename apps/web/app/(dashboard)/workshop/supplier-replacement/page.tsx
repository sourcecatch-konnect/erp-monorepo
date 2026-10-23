import { ProtectedRoute } from "@/features/auth";
import { SupplierReplacementListPage } from "@/features/supplier-replacement";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.REPLACEMENT_VIEW}>
      <SupplierReplacementListPage />
    </ProtectedRoute>
  );
}
