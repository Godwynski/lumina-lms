import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { SettingsContent } from "./SettingsContent";
import SettingsLoading from "./loading";

export const metadata = {
  title: "Settings | Lumina Library",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user?.id) {
    redirect("/auth/login");
  }

  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent user={userResult.user} />
    </Suspense>
  );
}
