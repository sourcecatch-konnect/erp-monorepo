import { ProtectedRoute } from "@/features/auth";
import { VoicePlayer } from "@/features/training";
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
      {/* Mounted once for the whole dashboard, because read-aloud is reachable
          from the Help panel on operational screens as well as from training.
          It renders nothing until something plays. */}
      <VoicePlayer />
    </ProtectedRoute>
  );
}
