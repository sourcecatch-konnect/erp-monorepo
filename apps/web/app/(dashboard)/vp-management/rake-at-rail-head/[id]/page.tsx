import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailRakeOperationDetail from "@/features/rail-rake-operation/RailRakeOperationDetail";

export default async function RakeAtRailHeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.RAKE_AT_RAIL_HEAD.VIEW}>
      <RailRakeOperationDetail id={decodeURIComponent(id)} context="railhead" />
    </ProtectedRoute>
  );
}
