import { ProtectedRoute } from "@/features/auth";
import { CashPlanningReportPage } from "@/features/cash-planning";
import { PERMS } from "@skerp/types";

export default async function Page({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return (
    <ProtectedRoute permission={PERMS.CASH_PLANNING.VIEW}>
      <CashPlanningReportPage date={date} />
    </ProtectedRoute>
  );
}
