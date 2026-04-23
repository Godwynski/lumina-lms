import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { UserDetailClient } from "./UserDetailClient";
import { mapProfileToUser } from "@/lib/utils/mappers";

export default function UserDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <div className="space-y-6">

      <Suspense fallback={<div className="p-8"><div className="h-64 w-full animate-pulse bg-muted rounded-xl" /></div>}>
        <UserDetailLoader params={props.params} />
      </Suspense>
    </div>
  );
}

async function UserDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const userId = resolvedParams.id;
  const supabase = await createClient();
  
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
    
  if (error || !data) notFound();
  
  const row = data;
  const mappedUser = mapProfileToUser(row as Record<string, unknown>);

  return <UserDetailClient initialUser={mappedUser} />;
}
