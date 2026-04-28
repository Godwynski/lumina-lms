import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { UsersContent } from "./UsersContent";
import { mapProfileToUser } from "@/lib/utils/mappers";

const PAGE_SIZE = 12;

// getMe() is cache()-memoized — reuses the auth result from the layout,
// zero extra network round-trip. The .then() chain is non-blocking.
function buildUsersPromise() {
  return getMe().then(async (me) => {
    if (!me) redirect("/login");
    const { supabase } = me;

    const { data, count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (error) throw error;

    return {
      users: (data || []).map((row) => mapProfileToUser(row as Record<string, unknown>)),
      count: count || 0,
    };
  });
}

// Synchronous page shell — responds immediately.
// Promise fires in the background; UsersContent uses use() to consume it.
export default function UsersPage() {
  const usersPromise = buildUsersPromise();

  return (
    <div className="space-y-6">
      <Suspense fallback={<UsersSkeleton />}>
        <UsersContent usersPromise={usersPromise} />
      </Suspense>
    </div>
  );
}

function UsersSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="h-10 w-64 bg-muted rounded-lg" />
      <div className="h-8 w-full bg-muted rounded-md" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full bg-muted/40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
