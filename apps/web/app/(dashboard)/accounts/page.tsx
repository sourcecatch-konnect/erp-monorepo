import { redirect } from "next/navigation";

/**
 * "/accounts" itself isn't a real screen — it only exists as the parent
 * segment for /accounts/lr-to-bill, /bills, /receipts, /billing-settings.
 * The breadcrumb turns every non-last path segment into a link, so this
 * redirect is what makes that "Accounts" crumb (and its prefetch) resolve
 * instead of 404ing.
 */
export default function AccountsHome() {
  redirect("/accounts/lr-to-bill");
}
