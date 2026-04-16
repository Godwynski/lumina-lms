import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UsersContent, User } from "./UsersContent";

export default async function UsersPage() {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <UsersDataWrapper />
    </Suspense>
  );
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  status: string | null;
  department: string | null;
  created_at: string | null;
}

async function UsersDataWrapper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
        const mapProfileToUser = (row: ProfileRow): User => ({
          id: String(row.id ?? ""),
          name: row.full_name || (row.email?.split("@")[0].split(".").map((p: string) => p[0]?.toUpperCase() + p.slice(1)).join(" ")) || "Unnamed User",
          email: row.email || "",
          avatarUrl: row.avatar_url || null,
          role: (row.role as User["role"]) || "student",
          status: row.status || "active",
          department: row.department || "General",
          joined: row.created_at ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Unknown",
        });
        return {
          users: (data as unknown as ProfileRow[] || []).map(mapProfileToUser),
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

