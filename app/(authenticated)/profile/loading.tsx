export default function Loading() {
  return (
    <div className="space-y-6 w-full">
      <div className="p-8 animate-pulse space-y-8">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-96 w-full bg-muted rounded" />
      </div>
    </div>
  );
}
