import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { UserDetailClient } from "./UserDetailClient";
import type { User } from "../UsersContent";

export default async function UserDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-64 w-full animate-pulse bg-muted rounded-xl" /></div>}>
      <UserDetailLoader params={props.params} />
    </Suspense>
  );
}

async function UserDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const userId = resolvedParams.id;
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
    
  if (error || !data) notFound();
  
  const row = data;
  const mappedUser: User = {
    id: String(row.id ?? ""),
    name: row.full_name || (row.email?.split("@")[0].split(".").map((p: string) => p[0]?.toUpperCase() + p.slice(1)).join(" ")) || "Unnamed User",
    email: row.email || "",
    avatarUrl: row.avatar_url || null,
    role: (row.role as User["role"]) || "student",
    status: row.status || "active",
    department: row.department || "General",
    joined: row.created_at ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Unknown",
  };

  return <UserDetailClient initialUser={mappedUser} />;
}
