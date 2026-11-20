import { Suspense } from "react";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { getAnalyticsSummary } from "@/lib/actions/analytics";
import { analyticsDates } from "@/lib/analytics-dates";
import { getMe } from "@/lib/auth-helpers";
import { AnalyticsClient } from "./AnalyticsClient";
import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const me = await getMe();
  if (!me) return null;
  
  const { role } = me;

  if (role !== 'super_admin' && role !== 'librarian') {
    redirect('/dashboard');
  }

  const initialDates = analyticsDates('30d');
  const statsPromise = getDashboardStats({ role, scope: 'analytics' });
  const initialSummaryPromise = getAnalyticsSummary('30d', initialDates).catch(() => null);
  
  return (
    <div className="flex flex-col gap-6 w-full">
      <Suspense fallback={
        <div className="flex items-center justify-center p-20">
           <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
        </div>
      }>
        <AnalyticsClient 
          statsPromise={statsPromise}
          initialSummaryPromise={initialSummaryPromise}
          initialDates={initialDates}
          role={role}
        />
      </Suspense>
    </div>
  );
}
