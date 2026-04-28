import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { NewUserClient } from "./NewUserClient";

// getMe() is cache()-memoized — reuses auth already fetched by the layout.
// NewUserClient is a pure client form with no server data deps beyond auth.
async function NewUserContent() {
  const me = await getMe();
  if (!me) redirect("/login");

  return <NewUserClient />;
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
