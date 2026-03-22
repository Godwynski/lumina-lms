import { UpdatePasswordForm } from "@/components/update-password-form";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

import { Suspense } from "react";

export const metadata = {
  title: "Update Password | Lumina LMS",
};

export default function UpdatePasswordPage() {
  return (
    <AuthPageShell
      badge="Security Maintenance"
      title="Set a new password for your account."
      description="Use a strong password with letters, numbers, and symbols to maintain account security."
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-slate-200" />}>
        <UpdatePasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
