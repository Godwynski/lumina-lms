import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect, notFound } from "next/navigation";
import { UserDetailClient } from "./UserDetailClient";
import { mapProfileToUser } from "@/lib/utils/mappers";
import { getBorrowingHistory } from "@/lib/actions/history";

export const metadata = { title: "User details" };

// getMe() is cache()-memoized — reuses auth already fetched by the layout.
// The profile lookup for the *target* user is the only DB call needed.
function buildUserDetailPromise(userId: string) {
  return getMe().then(async (me) => {
    if (!me) redirect("/");
    if (me.role !== "super_admin" && me.role !== "librarian") {
      redirect("/dashboard");
    }
    const { supabase } = me;

    const [{ data, error }, history] = await Promise.all([
      supabase
        .from("profiles")
        .select("*, library_cards(*)")
        .eq("id", userId)
        .single(),
      getBorrowingHistory(userId, 1, 10, "all", undefined, supabase),
    ]);

    if (error || !data) notFound();

    return {
      user: mapProfileToUser(data as Record<string, unknown>),
      history,
      role: me.role,
    };
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
  const { user, history, role } = await buildUserDetailPromise(id);
  return <UserDetailClient initialUser={user} currentRole={role} initialHistory={history} />;
}
