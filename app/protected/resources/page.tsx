import { Suspense } from "react";
import { ResourcesContent } from "./ResourcesContent";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function DigitalResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const viewId = resolvedParams.view as string | undefined;
  const query = resolvedParams.q as string | undefined;

  return (
    <div className="w-full">
      <Suspense fallback={<ResourcesSkeleton />}>
        <ResourcesContent viewId={viewId} query={query} />
      </Suspense>
    </div>
  );
}

function ResourcesSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="flex justify-between items-center h-12 bg-muted rounded-xl px-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border-border/60">
            <CardHeader className="p-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Skeleton className="h-24 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
