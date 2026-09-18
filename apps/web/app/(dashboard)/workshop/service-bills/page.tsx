import { ProtectedRoute } from "@/features/auth";
import { ServiceBillListPage } from "@/features/service-bill";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.SERVICEBILL_VIEW}>
      <ServiceBillListPage />
    </ProtectedRoute>
  );
}
