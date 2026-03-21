import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

import { Suspense } from "react";

export const metadata = {
  title: "Forgot Password | Lumina LMS",
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      badge="Credential Recovery"
      title="Reset your password securely."
      description="Enter your email address and we will send a verification link to complete the reset process."
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-slate-200" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
