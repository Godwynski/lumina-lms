export type AnalyticsDates = { from: string; to: string };
export function validateDates(dates: AnalyticsDates): boolean {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  return valid(dates.from) && valid(dates.to) && dates.from <= dates.to &&
    Date.parse(dates.to) - Date.parse(dates.from) <= 366 * 86400000;
}
export function analyticsDates(range: '7d' | '30d' | '1y', now = new Date()): AnalyticsDates {
  const to = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const start = new Date(to + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - (range === '7d' ? 6 : range === '30d' ? 29 : 364));
  if (range === '1y') {
    start.setTime(Date.parse(to + 'T00:00:00Z'));
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 11);
  }
  return { from: start.toISOString().slice(0, 10), to };
}
