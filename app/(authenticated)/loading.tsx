export default function AuthenticatedLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-8 w-48 bg-muted/30 rounded-lg" />
      <div className="h-[400px] w-full bg-muted/10 rounded-2xl border border-border/10" />
    </div>
  );
}
