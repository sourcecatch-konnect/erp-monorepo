import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import DeliveryChallanList from "@/features/delivery-challan/DeliveryChallanList";

export default function DeliveryChallansPage() {
  return (
    <ProtectedRoute permission={PERMS.DELIVERY_CHALLAN.VIEW}>
      <DeliveryChallanList />
    </ProtectedRoute>
  );
}
