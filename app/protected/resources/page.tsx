import { createClient } from "@/lib/supabase/server";
import { 
  BookOpen, 
  Search, 
  FileText, 
  Calendar,
  User,
  Shield,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadAction } from "@/components/digital-resources/UploadAction";
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

  const isAdmin = profile?.role === "admin";
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
    resourcesQuery = resourcesQuery.ilike("title", `%${query}%`);
  }

  const { data: resources } = await resourcesQuery;

  // If a specific resource is being viewed
  let selectedResource = null;
  if (viewId) {
    selectedResource = resources?.find(r => r.id === viewId);
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-zinc-200/60 shadow-xl shadow-zinc-100/50 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Digital Library</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">School Server Intranet</p>
              </div>
            </div>
          </div>
          <p className="text-zinc-500 max-w-md leading-relaxed">
            Access our exclusive digital collection of e-books, journals, and local research archives.
          </p>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <form action="/protected/resources" method="GET">
              <Input 
                name="q"
                placeholder="Search the collection..." 
                defaultValue={query}
                className="pl-12 h-14 bg-zinc-50/50 border-zinc-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all rounded-2xl text-base shadow-sm"
              />
            </form>
          </div>
          {isLibrarian && (
             <UploadAction categories={categories || []} />
          )}
        </div>

        {/* Premium Decorative background elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-indigo-100/40 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-100/30 rounded-[100%] blur-[60px]" />
      </div>

      {selectedResource ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between bg-white/50 backdrop-blur-md p-5 rounded-3xl border border-zinc-200/60 shadow-sm">
             <Link href="/protected/resources">
               <Button variant="ghost" size="sm" className="text-zinc-600 hover:bg-zinc-100 rounded-xl px-4">
                 <ChevronLeft className="mr-2" size={18} />
                 Back to Library
               </Button>
             </Link>
             <div className="flex items-center gap-3">
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] px-4 py-1.5 bg-indigo-50 border border-indigo-100/50 rounded-full shadow-sm">
                 {selectedResource.type}
               </span>
                {isAdmin && selectedResource && (
                  <EditResourceMetadataDialog
                    resource={selectedResource}
                    categories={categories || []}
                  />
                )}
              </div>
           </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 h-[800px]">
              <PDFViewerWrapper 
                resourceId={selectedResource.id} 
                fileUrl={`/api/resources/${selectedResource.file_path}`} 
                title={selectedResource.title} 
              />
            </div>
            
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-xl shadow-zinc-100/50 space-y-6">
                <h3 className="text-lg font-bold text-zinc-900 border-b border-zinc-100 pb-4">Metadata</h3>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Author</p>
                      <p className="text-base font-semibold text-zinc-900">{selectedResource.author}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Published</p>
                      <p className="text-base font-semibold text-zinc-900">
                        {selectedResource.published_year || new Date(selectedResource.created_at).getFullYear()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                      <Shield size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Availability</p>
                      <p className="text-base font-semibold text-zinc-900">{selectedResource.access_level}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">File Format</p>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-zinc-900">PDF Document</p>
                        <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-md">{selectedResource.file_size_mb} MB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100 relative overflow-hidden group">
                 <div className="relative z-10">
                   <h4 className="font-bold mb-2">Offline Reading</h4>
                   <p className="text-sm text-indigo-100 opacity-80 mb-4">
                     Request an offline PIN to access this and other resources during internet blackouts.
                   </p>
                   <Link href="/offline-access">
                     <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-none rounded-xl">
                       Get Offline PIN
                     </Button>
                   </Link>
                 </div>
                 <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {resources?.map((resource) => (
                <div 
                  key={resource.id} 
                  className="group relative bg-white p-6 rounded-[2rem] border border-zinc-200 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-start justify-between mb-6">
                    <div className="h-14 w-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500">
                      <FileText size={28} />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100/50">
                        {resource.type}
                      </span>
                      {resource.categories?.name && (
                        <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-tighter">
                          {resource.categories.name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight mb-2">
                      {resource.title}
                    </h3>
                    <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform duration-300">
                      <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center">
                        <User size={12} className="text-zinc-400" />
                      </div>
                      <p className="text-sm font-medium text-zinc-500">{resource.author}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-zinc-50">
                    <div className="flex items-center gap-3">
                       <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
                          <Calendar size={13} className="text-zinc-300" />
                          {resource.published_year || new Date(resource.created_at).getFullYear()}
                       </div>
                       <div className="w-1 h-1 bg-zinc-200 rounded-full" />
                       <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                          <Shield size={13} className="opacity-70" />
                          {resource.access_level}
                       </div>
                    </div>
                    
                    <Link href={`/protected/resources?view=${resource.id}`}>
                      <Button size="sm" className="rounded-xl px-5 bg-zinc-900 hover:bg-indigo-600 text-white shadow-lg transition-all active:scale-95">
                        Read
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {(!resources || resources.length === 0) && (
              <div className="bg-white p-20 rounded-3xl border border-dashed border-zinc-300 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300 mb-4">
                  <Search size={32} />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-1">No resources found</h3>
                <p className="text-sm text-zinc-500">Try adjusting your search terms or upload a new resource.</p>
              </div>
            )}
          </div>

            {/* Sidebar (Admin/Stats) */}
            <div className="space-y-6">
            <div className="bg-white/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-zinc-200/60 shadow-xl shadow-zinc-100/50 relative overflow-hidden group">
               <div className="relative z-10">
                 <div className="flex items-center gap-2.5 text-indigo-600 mb-6 bg-indigo-50 w-fit px-4 py-1.5 rounded-full border border-indigo-100/50">
                    <Shield size={14} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Intranet Fortress</span>
                 </div>
                 <h4 className="text-2xl font-bold mb-4 tracking-tight leading-tight text-zinc-900">Local School Network Active</h4>
                 <p className="text-zinc-500 text-sm leading-relaxed mb-8">
                   Your connection is secured within the school intranet. All digital resources are served locally for zero-latency access and maximum data privacy.
                 </p>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="p-5 bg-zinc-50/50 rounded-3xl border border-zinc-100 backdrop-blur-sm group-hover:bg-white transition-colors">
                      <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">Node Status</p>
                      <div className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        Online
                      </div>
                   </div>
                   <div className="p-5 bg-zinc-50/50 rounded-3xl border border-zinc-100 backdrop-blur-sm group-hover:bg-white transition-colors">
                       <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-2">Server IP</p>
                       <p className="text-sm font-mono font-bold text-zinc-600">192.168.1.10</p>
                   </div>
                 </div>
               </div>
               
               {/* Decorative background element */}
               <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-50 rounded-full blur-[100px] group-hover:bg-indigo-100/50 transition-all duration-1000" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


