"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import type { PermissionKey } from "@skerp/types";

/**
 * Returns whether the current user has the given permission key. Reads from
 * the Redux auth slice (populated by /auth/me). Server is still the source
 * of truth — this is for hiding buttons, not for security.
 *
 *   const canApprove = useCan(PERMS.LORRY_RECEIPT.APPROVE);
 */
export const useCan = (key: PermissionKey | undefined): boolean => {
  const permissions = useAppSelector((s) => s.auth.user?.permissions);
  return useMemo(() => {
    if (!key) return true;
    if (!permissions) return false;
    return permissions.includes(key);
  }, [permissions, key]);
};

/** Returns true if the user has ANY of the listed keys. */
export const useCanAny = (...keys: PermissionKey[]): boolean => {
  const permissions = useAppSelector((s) => s.auth.user?.permissions);
  return useMemo(() => {
    if (!permissions) return false;
    return keys.some((k) => permissions.includes(k));
  }, [permissions, keys]);
};
