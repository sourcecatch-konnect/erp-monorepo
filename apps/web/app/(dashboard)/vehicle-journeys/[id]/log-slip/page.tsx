import { ProtectedRoute } from "@/features/auth";
import { LogSlipWorkbench } from "@/features/vehicle-journeys";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.LOGSLIP.VIEW}>
      <LogSlipWorkbench journeyId={id} />
    </ProtectedRoute>
  );
}
