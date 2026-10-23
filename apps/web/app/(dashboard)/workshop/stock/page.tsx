import { ProtectedRoute } from "@/features/auth";
import { StockListPage } from "@/features/stock";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.INWARD_VIEW}>
      <StockListPage />
    </ProtectedRoute>
  );
}
