import { ProtectedRoute } from "@/features/auth";
import VPLoadingDetail from "@/features/vp-loading/vp-loadingDetail";
import { PERMS } from "@skerp/types";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rowId?: string }>;
}) {
  const { id } = await params;
  const { rowId } = await searchParams;

  return (
    <ProtectedRoute permission={PERMS.VP_LOADING.VIEW}>
      <VPLoadingDetail
        scheduleId={decodeURIComponent(id)}
        initialRowId={rowId ? decodeURIComponent(rowId) : undefined}
      />
    </ProtectedRoute>
  );
}
