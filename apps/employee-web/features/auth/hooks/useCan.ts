"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import type { PermissionKey } from "@skerp/types";

export const useCan = (key: PermissionKey | undefined): boolean => {
    const permissions = useAppSelector((s) => s.auth.user?.permissions);
    return useMemo(() => {
        if (!key) return true;
        if (!permissions) return false;
        return permissions.includes(key);
    }, [permissions, key]);
};

export const useCanAny = (...keys: PermissionKey[]): boolean => {
    const permissions = useAppSelector((s) => s.auth.user?.permissions);
    return useMemo(() => {
        if (!permissions) return false;
        return keys.some((k) => permissions.includes(k));
    }, [permissions, keys]);
};