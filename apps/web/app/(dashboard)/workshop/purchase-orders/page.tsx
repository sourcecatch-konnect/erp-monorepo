import { ProtectedRoute } from "@/features/auth";
import { PurchaseOrderListPage } from "@/features/purchase-order";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.PO_VIEW}>
      <PurchaseOrderListPage />
    </ProtectedRoute>
  );
}
