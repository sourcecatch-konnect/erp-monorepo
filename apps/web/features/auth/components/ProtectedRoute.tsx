"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TruckLoader } from "@skerp/ui/components/truck-loader";
import { useAppSelector } from "@/store/hooks";
import { ROUTES } from "@/config/routes";
import type { PermissionKey } from "@skerp/types";

/**
 * Gates a page on an authenticated session, and optionally a permission key.
 *  - idle / loading      -> full-screen loader (bootstrap in progress)
 *  - unauthenticated     -> redirect to /login
 *  - authenticated       -> render (or show "Not authorised" if permission missing)
 */
export function ProtectedRoute({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: PermissionKey;
}) {
  const router = useRouter();
  const status = useAppSelector((state) => state.auth.status);
  const permissions = useAppSelector(
    (state) => state.auth.user?.permissions
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(ROUTES.login);
    }
  }, [status, router]);

  if (status === "authenticated") {
    if (permission && !permissions?.includes(permission)) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex max-w-sm flex-col items-center gap-2 text-center">
            <h1 className="text-lg font-semibold text-foreground">
              Not authorised
            </h1>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to view this page.
            </p>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <TruckLoader />
    </div>
  );
}
