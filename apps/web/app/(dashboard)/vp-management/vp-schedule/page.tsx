import { ProtectedRoute } from "@/features/auth";
import { VPScheduleListPage } from "@/features/VP-Schedule/vp-scheduleListPage";
import { PERMS } from "@skerp/types";
export default function Page() {
  return (
    <ProtectedRoute permission={PERMS.VP_SCHEDULE.VIEW}>
      <VPScheduleListPage />
    </ProtectedRoute>
  );
}