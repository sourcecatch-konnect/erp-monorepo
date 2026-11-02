"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setAuthFailureHandler, setForbiddenHandler } from "@/lib/api";
import { fetchMe, refreshMe, sessionExpired } from "../store/authSlice";

/**
 * Runs once on app load:
 *  - wires the axios interceptor's "refresh failed" and "forbidden" callbacks
 *    into Redux, and
 *  - attempts to restore the session via GET /auth/me (persistent login).
 *
 * The axios interceptor transparently refreshes an expired access token, so
 * fetchMe only fails when there is genuinely no valid session.
 *
 * It also keeps `permissions` from going stale. The list is read once at load,
 * so an admin changing a role leaves every open tab offering actions the
 * server now refuses. Two cheap signals fix that: regaining window focus
 * (you were away, something may have changed) and any 403 (proof that it did).
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    setAuthFailureHandler(() => {
      dispatch(sessionExpired());
    });
    setForbiddenHandler(() => {
      void dispatch(refreshMe());
    });
    void dispatch(fetchMe());
  }, [dispatch]);

  useEffect(() => {
    const onFocus = () => {
      // The thunk's `condition` drops this if one is already in flight, and
      // the reducer ignores the result unless a session is still live.
      void dispatch(refreshMe());
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [dispatch]);

  return <>{children}</>;
}
