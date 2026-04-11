import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewUserClient } from "./NewUserClient";

export default async function NewUserPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Optional: check admin status
  return (
    <Suspense fallback={<div className="p-8"><div className="h-32 w-full animate-pulse bg-muted rounded-xl" /></div>}>
      <NewUserClient />
    </Suspense>
  );
}
