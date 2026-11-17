import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Update Password",
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

    if (profile?.role === "patron") {
      redirect("/security");
    }
  }

  return (
    <AuthPageShell>
      <Suspense fallback={<div className="h-80 w-full animate-pulse rounded-2xl bg-muted" />}>
        <UpdatePasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
