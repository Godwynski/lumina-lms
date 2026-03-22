export const metadata = {
  title: "Borrowing History | Lumina LMS",
};

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My History</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Review your borrowing timeline, due dates, and completed returns in one place.</p>
      </section>
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm font-medium text-slate-600">History records will appear here as circulation activity is logged.</p>
      </section>
    </div>
  );
}
