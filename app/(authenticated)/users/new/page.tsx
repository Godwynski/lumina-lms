import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { NewUserClient } from "./NewUserClient";

export const metadata = { title: "Invite User" };

// getMe() is cache()-memoized — reuses auth already fetched by the layout.
// NewUserClient is a pure client form with no server data deps beyond auth.
export async function NewUserContent() {
  const me = await getMe();
  if (!me) redirect("/");
  if (me.role !== "super_admin" && me.role !== "librarian") {
    redirect("/dashboard");
  }

  return <NewUserClient currentRole={me.role} />;
}

export default function NewUserPage() {
  return (
    <div className="w-full space-y-6">
      <Suspense fallback={<div className="p-8"><div className="h-64 w-full animate-pulse bg-muted rounded-xl" /></div>}>
        <NewUserContent />
      </Suspense>
    </div>
  );
}
