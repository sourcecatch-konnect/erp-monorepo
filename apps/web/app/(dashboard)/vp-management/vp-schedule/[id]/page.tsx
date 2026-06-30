// apps/web/app/(dashboard)/operations/vp-schedule/[id]/page.tsx

import { ProtectedRoute } from "@/features/auth";
import VPScheduleDetail from "@/features/VP-Schedule/vp-scheduleDetail";

import { PERMS } from "@skerp/types";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.VP_SCHEDULE.VIEW}>
      <VPScheduleDetail scheduleId={id} />
    </ProtectedRoute>
  );
}