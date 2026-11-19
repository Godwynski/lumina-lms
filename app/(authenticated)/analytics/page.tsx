import { Suspense } from "react";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { getAnalyticsSummary } from "@/lib/actions/analytics";
import { analyticsDates } from "@/lib/analytics-dates";
import { getMe } from "@/lib/auth-helpers";
import { getReportDatasets } from "@/lib/auth/report-access";
import { AnalyticsClient } from "./AnalyticsClient";
import { redirect } from "next/navigation";
import AnalyticsLoading from "./loading";

export const metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const me = await getMe();
  if (!me) return null;
  
  const { role } = me;

  if (!getReportDatasets(role, me.profile).length) redirect('/dashboard');
  if (role !== 'super_admin' && role !== 'librarian') {
    redirect('/analytics/reports');
  }

  const initialDates = analyticsDates('30d');
  const statsPromise = getDashboardStats({ role, scope: 'analytics' });
  const initialSummaryPromise = getAnalyticsSummary('30d', initialDates).catch(() => null);
  
  return (
    <Suspense fallback={<AnalyticsLoading />}>
      <AnalyticsClient
        statsPromise={statsPromise}
        initialSummaryPromise={initialSummaryPromise}
        initialDates={initialDates}
        role={role}
      />
    </Suspense>
  );
}
