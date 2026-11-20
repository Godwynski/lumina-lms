function manilaDateDayNumber(value: string | number | Date): number {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  const [y, m, d] = formatted.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Computes the overdue fine in PHP using Asia/Manila calendar days.
 * Returns any snapshotted fine_amount when already recorded.
 */
export function computeOverdueFine(
  record: { due_date: string; returned_at: string | null; status?: string; fine_amount?: number | string | null },
  fineRate = 5
): number {
  if (record.fine_amount != null) return Number(record.fine_amount);
  if (record.returned_at != null) return 0;
  const dueMs = new Date(record.due_date).getTime();
  if (Number.isNaN(dueMs)) return 0;
  const now = Date.now();
  if (now <= dueMs && record.status?.toUpperCase() !== "OVERDUE") return 0;
  const days = Math.max(1, manilaDateDayNumber(now) - manilaDateDayNumber(dueMs));
  return Number((days * fineRate).toFixed(2));
}
