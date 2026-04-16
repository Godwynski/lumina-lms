import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewUserClient } from "./NewUserClient";

async function NewUserContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NewUserClient />;
}

export default function NewUserPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-32 w-full animate-pulse bg-muted rounded-xl" /></div>}>
      <NewUserContent />
    </Suspense>
  );
}
