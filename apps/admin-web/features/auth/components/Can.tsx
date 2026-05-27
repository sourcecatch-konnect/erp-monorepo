"use client";

import { ReactNode } from "react";
import type { PermissionKey } from "@skerp/types";
import { useCan } from "../hooks/useCan";

type Props = {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Conditionally render based on a permission key.
 *
 *   <Can permission={PERMS.LORRY_RECEIPT.APPROVE}>
 *     <Button>Approve</Button>
 *   </Can>
 */
export function Can({ permission, children, fallback = null }: Props) {
  const allowed = useCan(permission);
  return <>{allowed ? children : fallback}</>;
}
