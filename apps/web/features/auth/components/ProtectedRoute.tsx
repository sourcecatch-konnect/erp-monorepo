"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconLock } from "@tabler/icons-react";
import { Button } from "@skerp/ui/components/button";
import { TruckLoader } from "@skerp/ui/components/truck-loader";
import { useAppSelector } from "@/store/hooks";
import { ROUTES } from "@/config/routes";
import { permissionLabel, type PermissionKey } from "@skerp/types";

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
  const permissions = useAppSelector((state) => state.auth.user?.permissions);

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

  if (
    status === "authenticated" &&
    permission &&
    !permissions?.includes(permission)
  ) {
    return <NotAuthorised permission={permission} />;
  }

  return <>{children}</>;
}

/**
 * A dead end is only useful if it says what's missing. Names the permission in
 * the same words the role editor uses, and the role that doesn't have it, so
 * the reader can ask an admin for something specific instead of "access".
 */
function NotAuthorised({ permission }: { permission: PermissionKey }) {
  const router = useRouter();
  const role = useAppSelector((state) => state.auth.user?.role?.name);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <IconLock size={20} />
        </span>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            You don&apos;t have access to this page
          </h1>
          <p className="text-sm text-muted-foreground">
            It needs the{" "}
            <span className="font-medium text-foreground">
              {permissionLabel(permission)}
            </span>{" "}
            permission
            {role ? (
              <>
                , which your role (
                <span className="font-medium text-foreground">{role}</span>)
                doesn&apos;t include
              </>
            ) : null}
            .
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Ask an admin to add it to your role, then reload this page.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Go back
          </Button>
          <Button onClick={() => router.push(ROUTES.dashboard)}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
