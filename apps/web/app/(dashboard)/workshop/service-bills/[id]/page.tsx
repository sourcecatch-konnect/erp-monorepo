"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/features/auth";
import { ServiceBillDetailPage } from "@/features/service-bill";
import { PERMS } from "@skerp/types";

export default function Page() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedRoute permission={PERMS.WORKSHOP.SERVICEBILL_VIEW}>
      <ServiceBillDetailPage serviceBillId={params.id} />
    </ProtectedRoute>
  );
}
