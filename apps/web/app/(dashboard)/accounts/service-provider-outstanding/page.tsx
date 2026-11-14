import { PERMS } from "@skerp/types";
import { ProtectedRoute } from "@/features/auth";
import { ServiceBillOutstandingPage } from "@/features/service-bill/ServiceBillOutstandingPage";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.SERVICEBILL_VIEW}>
      <ServiceBillOutstandingPage />
    </ProtectedRoute>
  );
}
