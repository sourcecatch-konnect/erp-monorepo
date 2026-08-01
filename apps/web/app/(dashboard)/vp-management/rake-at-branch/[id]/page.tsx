import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailRakeOperationDetail from "@/features/rail-rake-operation/RailRakeOperationDetail";

export default async function RakeAtBranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.RAKE_AT_BRANCH.VIEW}>
      <RailRakeOperationDetail id={decodeURIComponent(id)} context="branch" />
    </ProtectedRoute>
  );
}
