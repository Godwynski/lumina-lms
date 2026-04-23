import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewUserClient } from "./NewUserClient";

async function NewUserContent() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) redirect("/login");

  return <NewUserClient />;
}

export default function NewUserPage() {
  return (
    <div className="w-full space-y-6">

      <Suspense fallback={<div className="p-8"><div className="h-64 w-full animate-pulse bg-muted rounded-xl" /></div>}>
        <NewUserContent />
      </Suspense>
    </div>
  );
}
