import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CirculationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian", "staff"].includes(String(profile.role))) {
    redirect("/protected");
  }

  return <>{children}</>;
}
