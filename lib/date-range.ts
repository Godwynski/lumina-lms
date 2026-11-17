const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });

/** True when the timestamp's Manila calendar date is within [from, to] (YYYY-MM-DD, either may be empty). */
export function isWithinManilaDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return false;
  const day = manilaDay.format(time);
  return (!from || day >= from) && (!to || day <= to);
}
