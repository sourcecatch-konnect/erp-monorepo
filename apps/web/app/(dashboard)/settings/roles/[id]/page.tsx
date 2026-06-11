import { ProtectedRoute } from "@/features/auth";
import { RoleDetailPage } from "@/features/rbac";
import { PERMS } from "@skerp/types";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProtectedRoute permission={PERMS.ADMIN.RBAC_MANAGE}>
      <RoleDetailPage roleId={id} />
    </ProtectedRoute>
  );
}
