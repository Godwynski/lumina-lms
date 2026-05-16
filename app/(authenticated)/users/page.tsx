import { Suspense, use } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { UsersContent } from "./UsersContent";
import { mapProfileToUser } from "@/lib/utils/mappers";

const PAGE_SIZE = 12;

// getMe() is cache()-memoized — reuses the auth result from the layout,
// zero extra network round-trip. The .then() chain is non-blocking.
function buildUsersPromise() {
  return getMe().then(async (me) => {
    if (!me) redirect("/");
    const { supabase, role } = me;

    if (role !== "admin" && role !== "librarian") {
      redirect("/dashboard");
    }

    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .neq("status", "ARCHIVED");

    // Librarian Restriction: Hide admins from initial fetch
    if (role === "librarian") {
      query = query.neq("role", "admin");
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (error) throw error;

    return {
      users: (data || []).map((row) => mapProfileToUser(row as Record<string, unknown>)),
      count: count || 0,
      currentRole: role,
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
        <UserPageWrapper usersPromise={usersPromise} />
      </Suspense>
    </div>
  );
}

function UserPageWrapper({ usersPromise }: { usersPromise: ReturnType<typeof buildUsersPromise> }) {
  const { currentRole } = use(usersPromise);
  
  return <UsersContent usersPromise={usersPromise} currentRole={currentRole as "admin" | "librarian" | "student_assistant" | "student"} />;
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
