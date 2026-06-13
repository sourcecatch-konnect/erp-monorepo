import { ProtectedRoute } from "@/features/auth";
import { OrdersListPage } from "@/features/orders";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ORDER.VIEW}>
      <OrdersListPage />
    </ProtectedRoute>
  );
}
