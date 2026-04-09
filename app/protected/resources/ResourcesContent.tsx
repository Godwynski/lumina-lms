import { createClient } from "@/lib/supabase/server";
import { sanitizeFilterInput } from "@/lib/utils";
import { DigitalResourcesClient } from "@/components/digital-resources/DigitalResourcesClient";
import PDFViewerWrapper from "@/components/digital-resources/PDFViewerWrapper";
import EditResourceMetadataDialog from "@/components/digital-resources/EditResourceMetadataDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, User, Calendar, Shield, FileText } from "lucide-react";
import Link from "next/link";

interface ResourcesContentProps {
  viewId?: string;
  query?: string;
}

export async function ResourcesContent({ viewId, query }: ResourcesContentProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isLibrarian = profile && ["admin", "librarian"].includes(profile.role);

  // Fetch categories for upload form
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  // Fetch resources
  let resourcesQuery = supabase
    .from("digital_resources")
    .select("*, categories(name)")
    .or("type.ilike.%capstone%,type.ilike.%thesis%")
    .order("created_at", { ascending: false });

  if (query) {
    const safeQuery = sanitizeFilterInput(query);
    if (viewId) {
      resourcesQuery = resourcesQuery.or(`title.ilike.%${safeQuery}%,id.eq.${viewId}`);
    } else {
      resourcesQuery = resourcesQuery.ilike("title", `%${safeQuery}%`);
    }
  }

  const { data: resources } = await resourcesQuery;

  // If a specific resource is being viewed
  let selectedResource = null;
  if (viewId) {
    selectedResource = resources?.find(r => r.id === viewId);
  }

  if (selectedResource) {
    return (
      <div className="w-full animate-in fade-in duration-700 pb-6 md:pb-8">
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <Link href="/protected/resources">
            <Button variant="ghost" size="sm" className="flex h-8 items-center gap-2 rounded-md px-2.5 font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronLeft size={16} />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-border bg-muted px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {selectedResource.type}
            </Badge>
            {isLibrarian && (
              <EditResourceMetadataDialog
                resource={selectedResource}
                categories={categories || []}
              />
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="h-[62vh] overflow-hidden rounded-xl border border-border bg-muted shadow-sm sm:h-[70vh] lg:col-span-9 lg:h-[78vh]">
            <PDFViewerWrapper 
              resourceId={selectedResource.id} 
              fileUrl={`/api/resources/${selectedResource.file_path}`} 
              title={selectedResource.title} 
            />
          </div>
          
          <div className="space-y-3 lg:col-span-3">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold tracking-tight text-foreground">Asset Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Originator", val: selectedResource.author, icon: User },
                  { label: "Release Cycle", val: selectedResource.published_year || new Date(selectedResource.created_at).getFullYear(), icon: Calendar },
                  { label: "Clearance", val: selectedResource.access_level, icon: Shield, color: "text-emerald-500" },
                  { label: "Format", val: `PDF (${selectedResource.file_size_mb} MB)`, icon: FileText },
                ].map((meta, i) => (
                  <div key={i} className="group flex items-start gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                      <meta.icon size={15} />
                    </div>
                    <div>
                      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{meta.label}</p>
                      <p className={`text-xs font-semibold text-foreground ${meta.color || ""}`}>{meta.val}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <DigitalResourcesClient 
        resources={resources || []} 
        categories={categories || []} 
        isLibrarian={!!isLibrarian}
        query={query}
      />
    </div>
  );
}
