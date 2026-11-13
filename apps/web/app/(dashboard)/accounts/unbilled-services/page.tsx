import { PERMS } from "@skerp/types";
import { ProtectedRoute } from "@/features/auth";
import { UnbilledServiceReportPage } from "@/features/service-bill/UnbilledServiceReportPage";
export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.SERVICEBILL_VIEW}>
      <UnbilledServiceReportPage />
    </ProtectedRoute>
  );
}
