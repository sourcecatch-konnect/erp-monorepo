import { ProtectedRoute } from "@/features/auth";
import LRUnloadingDetailPage from "@/features/lorry-receipts/LRUnloadingDetailPage";
import { PERMS } from "@skerp/types";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.LORRY_RECEIPT.VIEW}>
      <LRUnloadingDetailPage id={id} />
    </ProtectedRoute>
  );
}
