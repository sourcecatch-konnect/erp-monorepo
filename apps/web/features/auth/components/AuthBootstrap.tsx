"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setAuthFailureHandler } from "@/lib/api";
import { fetchMe, sessionExpired } from "../store/authSlice";

/**
 * Runs once on app load:
 *  - wires the axios interceptor's "refresh failed" callback into Redux, and
 *  - attempts to restore the session via GET /auth/me (persistent login).
 *
 * The axios interceptor transparently refreshes an expired access token, so
 * fetchMe only fails when there is genuinely no valid session.
 */
export function AuthBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    setAuthFailureHandler(() => {
      dispatch(sessionExpired());
    });
    dispatch(fetchMe());
  }, [dispatch]);

  return <>{children}</>;
}
