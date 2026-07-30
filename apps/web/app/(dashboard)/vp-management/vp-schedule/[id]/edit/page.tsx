import { ProtectedRoute } from "@/features/auth";
import { VPScheduleEditPage } from "@/features/VP-Schedule/vp-scheduleEditPage";

import { PERMS } from "@skerp/types";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;

  return (
    <ProtectedRoute permission={PERMS.VP_SCHEDULE.UPDATE}>
      <VPScheduleEditPage scheduleId={id} />
    </ProtectedRoute>
  );
}
