import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ApprovalsContent, PendingCard } from "./ApprovalsContent";

export default async function ApprovalsPage() {
  return (
    <Suspense fallback={<ApprovalsSkeleton />}>
      <ApprovalsDataWrapper />
    </Suspense>
  );
}

async function ApprovalsDataWrapper() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const cardsPromise = Promise.resolve(
    supabase
      .from("library_cards")
      .select(`
        *,
        profiles:user_id (
          full_name,
          student_id,
          department,
          avatar_url,
          email
        )
      `)
      .eq("status", "pending")
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as unknown as PendingCard[]) || [];
      })
  );

  return <ApprovalsContent cardsPromise={cardsPromise} />;
}

function ApprovalsSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="h-10 w-64 bg-muted rounded-lg" />
      <div className="h-8 w-full bg-muted rounded-md" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 w-full bg-muted/40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

