import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailBranchGRNEditPage from "@/features/rail-branch-grn/rail-branch-grnEdit";


type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.RAIL_BRANCH_GRN.UPDATE}>
      <RailBranchGRNEditPage branchGrnId={decodeURIComponent(id)} />
    </ProtectedRoute>
  );
}