/** Credentials submitted from the login form. */
export type LoginPayload = {
  email: string;
  password: string;
};

/** Authenticated user as returned by the server (password stripped). */
export type AuthUser = {
  id: string;
  userName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  companyId: string;
  branchId: string;
  roleId: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
  /**
   * Flat list of permission keys the user holds. Populated from /auth/me;
   * empty for login responses (call fetchMe after login to refresh).
   */
  permissions?: string[];
  branchScope?: "ALL" | "ASSIGNED";
  branchIds?: string[];
};

/**
 * idle           — bootstrap not finished yet (don't render protected/login UI)
 * loading        — a login or fetchMe request is in flight
 * authenticated  — a valid user is loaded
 * unauthenticated— no session; user must log in
 */
export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated";

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  /**
   * A background re-read of /auth/me is in flight (window refocus, or a 403
   * suggesting our permission list is stale). Separate from `status` so a
   * silent refresh never moves an authenticated session back to `loading`.
   */
  refreshing: boolean;
}
