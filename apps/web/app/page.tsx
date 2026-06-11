import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

/**
 * Entry point. The dashboard is protected, so ProtectedRoute will bounce
 * unauthenticated visitors to /login once the session is resolved.
 */
export default function AdminHome() {
  redirect(ROUTES.dashboard);
}
