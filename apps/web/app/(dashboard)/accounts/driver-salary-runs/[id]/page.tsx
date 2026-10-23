"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { SalaryRunDetailPage } from "@/features/driver-finance";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.DRIVER_FINANCE.SALARY_VIEW}>
      <SalaryRunDetailPage id={params.id} />
    </ProtectedRoute>
  );
}
