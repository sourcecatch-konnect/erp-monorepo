"use client";
import { ProtectedRoute } from "@/features/auth";
import { LRDetail } from "@/features/lorry-receipts";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.LORRY_RECEIPT.VIEW}>
      <LRDetail id={id} />
    </ProtectedRoute>
  );
}
