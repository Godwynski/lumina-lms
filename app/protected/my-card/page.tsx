export const metadata = {
  title: "My Library Card | Lumina LMS",
};

export default function MyCardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-zinc-900">E-Library Card</h1>
      <p className="text-zinc-500 text-sm">View and manage your digital library card here.</p>
    </div>
  );
}
