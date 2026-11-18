import { redirect } from "next/navigation";
import { analyticsDates, validateDates } from "@/lib/analytics-dates";
import { getMe } from "@/lib/auth-helpers";
import { getReportDatasets } from "@/lib/auth/report-access";
import { ReportBuilder } from "./ReportBuilder";

export const metadata = { title: "Report Builder" };

export default async function ReportsPage({ searchParams }: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const me = await getMe();
  if (!me) redirect("/");
  const datasets = getReportDatasets(me.role, me.profile);
  if (!datasets.length) redirect("/dashboard");
  const { from, to } = await searchParams;
  const dates = typeof from === "string" && typeof to === "string" && validateDates({ from, to }) ? { from, to } : analyticsDates("30d");
  return <ReportBuilder datasets={datasets} accountId={me.user.id} initialDates={dates} />;
}
