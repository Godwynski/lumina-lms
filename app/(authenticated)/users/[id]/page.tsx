import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect, notFound } from "next/navigation";
import { UserDetailClient } from "./UserDetailClient";
import { mapProfileToUser } from "@/lib/utils/mappers";

// getMe() is cache()-memoized — reuses auth already fetched by the layout.
// The profile lookup for the *target* user is the only DB call needed.
function buildUserDetailPromise(userId: string) {
  return getMe().then(async (me) => {
    if (!me) redirect("/login");
    const { supabase } = me;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) notFound();

    return mapProfileToUser(data as Record<string, unknown>);
  });
}

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
  const { id } = await params;
  const user = await buildUserDetailPromise(id);
  return <UserDetailClient initialUser={user} />;
}
