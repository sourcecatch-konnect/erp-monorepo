/**
 * Public API of the auth feature. App routes and shared components should
 * import auth pieces from here ("@/features/auth"), not from internal paths.
 */
export { useAuth } from "./hooks/useAuth";
export { useCan, useCanAny } from "./hooks/useCan";
export { AuthBootstrap } from "./components/AuthBootstrap";
export { ProtectedRoute } from "./components/ProtectedRoute";
export { Can } from "./components/Can";
export { LoginForm } from "./components/LoginForm";
export { ForgotPasswordForm } from "./components/ForgotPasswordForm";
export { ResetPasswordForm } from "./components/ResetPasswordForm";
export {
  login,
  logout,
  fetchMe,
  sessionExpired,
} from "./store/authSlice";
export type {
  AuthUser,
  AuthStatus,
  AuthState,
  LoginPayload,
} from "./types";
