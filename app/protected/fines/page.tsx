export const metadata = {
  title: "My Fines | Lumina LMS",
};

export default function FinesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Fines</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Track borrower penalties, payment status, and exception handling from one clean operational view.</p>
      </section>
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <p className="text-sm font-medium text-slate-600">No fine records are currently displayed in this environment.</p>
      </section>
    </div>
  );
}
