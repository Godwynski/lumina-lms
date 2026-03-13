export const metadata = {
  title: "Borrowing History | Lumina LMS",
};

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-zinc-900">My History</h1>
      <p className="text-zinc-500 text-sm">View your borrowing history and self-service renewals here.</p>
    </div>
  );
}
