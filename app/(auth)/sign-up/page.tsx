import { SignUpForm } from "@/components/auth/SignUpForm";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

export const metadata = {
  title: "Sign Up | Lumina LMS",
};


export default async function SignUpPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return redirect("/dashboard");
  }

  return (
    <AuthPageShell
      title="Create your account to access library services."
      description="Register to use book search, borrowing features, and digital resource access in the Lumina platform."
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-slate-200" />}>
        <SignUpForm />
      </Suspense>
    </AuthPageShell>
  );
}
