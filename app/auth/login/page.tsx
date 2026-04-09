import { LoginForm } from "@/components/auth/LoginForm";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

export const metadata = {
  title: "Sign In | Lumina LMS",
};


export default async function LoginPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return redirect("/dashboard");
  }

  return (
    <AuthPageShell
      badge="Secure Workspace Access"
      title="Sign in to your library operations account."
      description="Use your assigned credentials to access catalog, circulation, and administrative tools."
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-slate-200" />}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
