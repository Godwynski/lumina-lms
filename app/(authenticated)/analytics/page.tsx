import { Suspense } from "react";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { getMe } from "@/lib/auth-helpers";
import { AnalyticsClient } from "./AnalyticsClient";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Analytics | Lumina LMS",
};

export default async function AnalyticsPage() {
  const me = await getMe();
  if (!me) return null;
  
  const { role } = me;

  if (role !== 'admin' && role !== 'librarian') {
    return <div className="p-8 text-center text-muted-foreground">Unauthorized access</div>;
  }

  const statsPromise = getDashboardStats({ role });
  
  return (
    <div className="flex flex-col gap-6 w-full">
      <Suspense fallback={
        <div className="flex items-center justify-center p-20">
           <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
        </div>
      }>
        <AnalyticsClient 
          statsPromise={statsPromise}
        />
      </Suspense>
    </div>
  );
}