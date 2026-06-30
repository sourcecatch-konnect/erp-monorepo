// apps/web/app/(protected)/operations/mrrr/page.tsx

import { ProtectedRoute } from "@/features/auth";
import { MRRRListPage } from "@/features/mrrr/mrrrListPage";

import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.MRRR.VIEW}>
      <MRRRListPage />
    </ProtectedRoute>
  );
}