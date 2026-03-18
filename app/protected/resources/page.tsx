import { createClient } from "@/lib/supabase/server";
import { 
  ChevronLeft,
  User,
  Calendar,
  Shield,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DigitalResourcesClient } from "@/components/digital-resources/DigitalResourcesClient";
import PDFViewerWrapper from "@/components/digital-resources/PDFViewerWrapper";
import EditResourceMetadataDialog from "@/components/digital-resources/EditResourceMetadataDialog";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DigitalResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isLibrarian = profile && ["admin", "librarian"].includes(profile.role);

  const resolvedParams = await searchParams;
  const viewId = resolvedParams.view as string | undefined;
  const query = resolvedParams.q as string | undefined;

  // Fetch categories for upload form
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  // Fetch resources
  let resourcesQuery = supabase
    .from("digital_resources")
    .select("*, categories(name)")
    .order("created_at", { ascending: false });

  if (query) {
    if (viewId) {
      resourcesQuery = resourcesQuery.or(`title.ilike.%${query}%,id.eq.${viewId}`);
    } else {
      resourcesQuery = resourcesQuery.ilike("title", `%${query}%`);
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
      <div className="flex flex-col gap-8 p-4 md:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-700">
        <div className="flex items-center justify-between bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl shadow-zinc-200/10">
          <Link href="/protected/resources">
            <Button variant="ghost" size="sm" className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl px-6 h-12 font-bold flex items-center gap-2">
              <ChevronLeft size={20} />
              Vault Archive
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] px-5 py-2 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100/50 dark:border-indigo-800/50 rounded-full shadow-sm">
              {selectedResource.type}
            </span>
            {isLibrarian && (
              <EditResourceMetadataDialog
                resource={selectedResource}
                categories={categories || []}
              />
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-3 h-[90vh] bg-zinc-100 dark:bg-zinc-900 rounded-[3rem] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <PDFViewerWrapper 
              resourceId={selectedResource.id} 
              fileUrl={`/api/resources/${selectedResource.file_path}`} 
              title={selectedResource.title} 
            />
          </div>
          
          <div className="space-y-8">
            <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl p-10 rounded-[3rem] border border-zinc-200/60 dark:border-zinc-800/60 shadow-2xl shadow-zinc-200/20">
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-6">Asset Intelligence</h3>
              <div className="space-y-8">
                {[
                  { label: "Originator", val: selectedResource.author, icon: User },
                  { label: "Release Cycle", val: selectedResource.published_year || new Date(selectedResource.created_at).getFullYear(), icon: Calendar },
                  { label: "Clearance", val: selectedResource.access_level, icon: Shield, color: "text-emerald-500" },
                  { label: "Format", val: `PDF (${selectedResource.file_size_mb} MB)`, icon: FileText },
                ].map((meta, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="h-10 w-10 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-indigo-500 transition-colors">
                      <meta.icon size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{meta.label}</p>
                      <p className={`text-base font-bold text-zinc-900 dark:text-white ${meta.color || ""}`}>{meta.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-10 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[3rem] text-white shadow-2xl shadow-indigo-500/30 relative overflow-hidden group">
               <div className="relative z-10">
                 <h4 className="text-xl font-bold mb-3">Offline Access</h4>
                 <p className="text-sm text-indigo-100/80 mb-8 leading-relaxed font-medium">
                   This asset is available for extraction to local secure devices. Use an offline PIN for encrypted access.
                 </p>
                 <Link href="/offline-access">
                   <Button className="w-full h-14 bg-white text-indigo-700 hover:bg-indigo-50 border-none rounded-2xl font-black text-xs uppercase tracking-widest transition-transform active:scale-95 shadow-xl">
                     Generate Security PIN
                   </Button>
                 </Link>
               </div>
               <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-[5s]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto w-full p-4 md:p-8">
      <DigitalResourcesClient 
        resources={resources} 
        categories={categories || []} 
        isLibrarian={!!isLibrarian}
        query={query}
      />
    </div>
  );
}
