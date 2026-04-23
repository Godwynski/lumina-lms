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
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (user) {
    return redirect("/dashboard");
  }
  return null;
}

export default function LoginPage() {
  return (
    <AuthPageShell>
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-slate-200" />}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
