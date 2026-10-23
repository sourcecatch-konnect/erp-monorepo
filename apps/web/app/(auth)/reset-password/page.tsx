import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth";

// ResetPasswordForm reads the `?token=` query via useSearchParams, which needs
// a Suspense boundary during prerender.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
