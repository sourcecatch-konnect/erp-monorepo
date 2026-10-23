"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TruckLoader } from "@skerp/ui/components/truck-loader";
import { useAppSelector } from "@/store/hooks";
import { ROUTES } from "@/config/routes";
import type { PermissionKey } from "@skerp/types";

/**
 * Gates a page on an authenticated session, and optionally a permission key.
 *  - idle             -> full-screen loader (bootstrap hasn't dispatched fetchMe yet — one render tick)
 *  - loading          -> render `children` optimistically (see below)
 *  - unauthenticated  -> full-screen loader while the redirect effect fires
 *  - authenticated    -> render (or show "Not authorised" if permission missing)
 *
 * `loading` renders children rather than blocking on a spinner: previously
 * this blocked on `status === "authenticated"`, which meant a page's own
 * data queries never even started until the fetchMe() round trip finished —
 * a fully sequential "check auth, then fetch data" waterfall on every single
 * page load. Letting the page mount during `loading` lets its queries fire
 * in parallel with fetchMe() instead. This doesn't weaken enforcement: the
 * API is the real gate regardless of what the client optimistically renders
 * (a genuinely unauthenticated request still 401s and the existing
 * interceptor handles that), and `useCan`/`Can` already fail closed — hide
 * gated UI — while `permissions` is undefined. The one deliberate trade: a
 * `permission`-gated page may briefly render its real content instead of
 * "Not authorised" during this window for a user who turns out to lack that
 * permission, self-correcting the moment `status` resolves to
 * "authenticated" — no data leaks either way, since the page's own queries
 * still hit the server's own permission check.
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

  if (status === "idle" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <TruckLoader />
      </div>
    );
  }

  if (status === "authenticated" && permission && !permissions?.includes(permission)) {
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
