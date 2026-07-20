
import { ProtectedRoute } from "@/features/auth";

import VPLoadingListPage from "@/features/vp-loading/vp-loadingPage";
 
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.VP_LOADING.VIEW}>
      <VPLoadingListPage/>
    </ProtectedRoute>
  );
}