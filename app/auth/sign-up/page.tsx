import { SignUpForm } from "@/components/auth/SignUpForm";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign Up | Lumina LMS",
};

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return redirect("/protected");
  }

  return (
    <AuthPageShell
      badge="New Account Provisioning"
      title="Create your account to access library services."
      description="Register to use book search, borrowing features, and digital resource access in the Lumina platform."
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-slate-200" />}>
        <SignUpForm />
      </Suspense>
    </AuthPageShell>
  );
}
