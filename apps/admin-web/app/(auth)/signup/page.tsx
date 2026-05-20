import Link from "next/link";

/**
 * Placeholder route only — admin accounts are provisioned server-side, so
 * there is intentionally no self-service signup UI in admin-web.
 */
export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">
          Signup not available
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Admin accounts are created by the system administrator. Please
          contact them to get access.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
