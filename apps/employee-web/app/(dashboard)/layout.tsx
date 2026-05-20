import { ProtectedRoute } from "@/features/auth";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Layout for every authenticated page. Gates access behind a valid session
 * and wraps the content in the sidebar/topbar app shell.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
