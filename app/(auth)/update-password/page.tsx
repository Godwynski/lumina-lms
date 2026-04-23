import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Update Password | Lumina LMS",
};

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "student") {
      redirect("/security");
    }
  }

  return (
    <AuthPageShell
      title="Set a new password for your account."
      description="Use a strong password with letters, numbers, and symbols to maintain account security."
    >
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-slate-200" />}>
        <UpdatePasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
