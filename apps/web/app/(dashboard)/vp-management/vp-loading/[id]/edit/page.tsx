import { ProtectedRoute } from "@/features/auth";
import VPLoadingForm from "@/features/vp-loading/vp-loadingForm";
import { PERMS } from "@skerp/types";

export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.VP_LOADING.UPDATE}>
      <VPLoadingForm mode="edit" />
    </ProtectedRoute>
  );
}
