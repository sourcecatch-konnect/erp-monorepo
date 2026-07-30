import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import DeliveryChallanForm from "@/features/delivery-challan/DeliveryChallanForm";

export default function NewDeliveryChallanPage() {
  return (
    <ProtectedRoute permission={PERMS.DELIVERY_CHALLAN.CREATE}>
      <DeliveryChallanForm mode="create" />
    </ProtectedRoute>
  );
}
