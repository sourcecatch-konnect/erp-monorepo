import { ProtectedRoute } from "@/features/auth";
import { OrderForm } from "@/features/orders";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.ORDER.CREATE}>
      <OrderForm mode="create" />
    </ProtectedRoute>
  );
}
