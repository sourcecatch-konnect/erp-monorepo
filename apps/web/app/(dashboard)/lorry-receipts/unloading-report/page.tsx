import { ProtectedRoute } from "@/features/auth";
import { LRUnloadingReportPage } from "@/features/lorry-receipts";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.LORRY_RECEIPT.VIEW}>
      <LRUnloadingReportPage />
    </ProtectedRoute>
  );
}
