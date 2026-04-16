import { createClient } from "@/lib/supabase/server";
import { OperationsSection } from "@/components/settings/sections/OperationsSection";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function OperationsContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return <OperationsSection role={profile?.role || "student"} />;
}

export default function OperationsPage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 w-full bg-muted rounded" /></div>}>
      <OperationsContent />
    </Suspense>
  );
}
