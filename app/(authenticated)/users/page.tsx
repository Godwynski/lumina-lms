import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UsersContent } from "./UsersContent";
import { mapProfileToUser } from "@/lib/utils/mappers";

export default function UsersPage() {
  return (
    <div className="space-y-6">

      <Suspense fallback={<UsersSkeleton />}>
        <UsersDataWrapper />
      </Suspense>
    </div>
  );
}


async function UsersDataWrapper() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) redirect("/login");

  const pageSize = 12;

  const usersPromise = Promise.resolve(
    supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, pageSize - 1)
      .then(({ data, count, error }) => {
        if (error) throw error;
        return {
          users: (data || []).map((row) => mapProfileToUser(row as Record<string, unknown>)),
          count: count || 0,
        };
      })
  );


  return <UsersContent usersPromise={usersPromise} />;
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

