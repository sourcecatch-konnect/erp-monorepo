import { PERMS } from "@skerp/types";

import { ProtectedRoute } from "@/features/auth";
import RailRakeOperationList from "@/features/rail-rake-operation/RailRakeOperationList";

export default function RakeAtRailHeadPage() {
  return (
    <ProtectedRoute permission={PERMS.RAKE_AT_RAIL_HEAD.VIEW}>
      <RailRakeOperationList context="railhead" />
    </ProtectedRoute>
  );
}
