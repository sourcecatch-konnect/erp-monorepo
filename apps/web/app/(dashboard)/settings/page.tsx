import { redirect } from "next/navigation";

/**
 * "/settings" itself isn't a real screen — same reasoning as
 * app/(dashboard)/accounts/page.tsx.
 */
export default function SettingsHome() {
  redirect("/settings/profile");
}
