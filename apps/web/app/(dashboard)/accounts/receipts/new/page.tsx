import { ProtectedRoute } from "@/features/auth";
import { ReceiptCreatePage } from "@/features/receivables";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.RECEIPT.CREATE}>
      <ReceiptCreatePage />
    </ProtectedRoute>
  );
}
