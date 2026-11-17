import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

import { Suspense } from "react";

export const metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={<div className="h-80 w-full animate-pulse rounded-2xl bg-muted" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
