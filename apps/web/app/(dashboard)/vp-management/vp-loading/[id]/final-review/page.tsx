import { ProtectedRoute } from "@/features/auth";
import VPLoadingFinalReview from "@/features/vp-loading/vp-loadingFinalReview";
import { PERMS } from "@skerp/types";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.VP_LOADING.VIEW}>
      <VPLoadingFinalReview scheduleId={decodeURIComponent(id)} />
    </ProtectedRoute>
  );
}
