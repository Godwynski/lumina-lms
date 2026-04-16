import { LoginForm } from "@/components/auth/LoginForm";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign In | Lumina LMS",
};


async function AuthRedirect() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return redirect("/dashboard");
  }
  return null;
}

export default function LoginPage() {
  return (
    <AuthPageShell
      title="Sign in to your library operations account."
      description="Use your assigned credentials to access catalog, circulation, and administrative tools."
    >
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-slate-200" />}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
