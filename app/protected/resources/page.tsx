import { createClient } from "@/lib/supabase/server";
import { 
  BookOpen, 
  Search, 
  Plus, 
  FileText, 
  Download, 
  Eye, 
  MoreVertical,
  Calendar,
  User,
  Shield,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadAction } from "@/components/digital-resources/UploadAction";
import { PDFViewer } from "@/components/digital-resources/PDFViewer";
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
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isStaff = profile && ["admin", "librarian", "staff"].includes(profile.role);
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
              <BookOpen size={20} />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Digital Resources</h1>
          </div>
          <p className="text-zinc-500 max-w-md">
            Access our digital collection of e-books, journals, and research papers exclusively on the school server.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <form action="/protected/resources" method="GET">
              <Input 
                name="q"
                placeholder="Search resources..." 
                defaultValue={query}
                className="pl-10 h-11 bg-zinc-50 border-zinc-200 focus:bg-white transition-all rounded-xl"
              />
            </form>
          </div>
          {isLibrarian && (
             <UploadAction categories={categories || []} />
          )}
        </div>

        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl" />
      </div>

      {selectedResource ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
             <Link href="/protected/resources">
               <Button variant="ghost" size="sm" className="text-zinc-600">
                 <ChevronLeft className="mr-2" size={16} />
                 Back to Collection
               </Button>
             </Link>
             <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-3 py-1 bg-white border border-zinc-200 rounded-full shadow-sm">
                 {selectedResource.type}
               </span>
               {isStaff && (
                 <Button variant="outline" size="sm" className="h-8 rounded-lg">
                   Manage
                 </Button>
               )}
             </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 h-[800px]">
              <PDFViewer 
                resourceId={selectedResource.id} 
                fileUrl={`/api/resources/${selectedResource.file_path}`} 
                title={selectedResource.title} 
              />
            </div>
            
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
                <h3 className="font-bold text-zinc-900 border-b border-zinc-100 pb-3">Details</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User size={16} className="text-zinc-400 mt-1" />
                    <div>
                      <p className="text-xs text-zinc-500">Author</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedResource.author}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar size={16} className="text-zinc-400 mt-1" />
                    <div>
                      <p className="text-xs text-zinc-500">Uploaded On</p>
                      <p className="text-sm font-medium text-zinc-900">
                        {new Date(selectedResource.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield size={16} className="text-zinc-400 mt-1" />
                    <div>
                      <p className="text-xs text-zinc-500">Access Level</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedResource.access_level}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText size={16} className="text-zinc-400 mt-1" />
                    <div>
                      <p className="text-xs text-zinc-500">File Size</p>
                      <p className="text-sm font-medium text-zinc-900">{selectedResource.file_size_mb} MB</p>
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
                   <Link href="/protected/offline-access-request">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resources?.map((resource) => (
                <div 
                  key={resource.id} 
                  className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-zinc-50 p-3 rounded-xl text-zinc-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                      <FileText size={24} />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-full uppercase tracking-tighter">
                      {resource.type}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1">
                      {resource.title}
                    </h3>
                    <p className="text-sm text-zinc-500 line-clamp-1 mb-4">by {resource.author}</p>
                    
                    <div className="flex items-center gap-3 mb-6">
                       <div className="flex items-center gap-1 text-xs text-zinc-400">
                          <Calendar size={12} />
                          {new Date(resource.created_at).getFullYear()}
                       </div>
                       <div className="w-1 h-1 bg-zinc-300 rounded-full" />
                       <div className="flex items-center gap-1 text-xs text-zinc-400">
                          <div className={`w-1.5 h-1.5 rounded-full ${resource.access_level === 'STUDENT' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {resource.access_level}
                       </div>
                    </div>
                  </div>

                  <Link href={`/protected/resources?view=${resource.id}`} className="w-full">
                    <Button variant="outline" className="w-full rounded-xl border-zinc-200 text-zinc-600 hover:text-indigo-600 hover:border-indigo-200 group-hover:bg-indigo-50/50">
                      Read Now
                    </Button>
                  </Link>
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
              <div className="bg-zinc-900 p-6 rounded-3xl text-white shadow-xl shadow-zinc-200 relative overflow-hidden">
               <div className="relative z-10">
                 <div className="flex items-center gap-2 text-indigo-400 mb-4">
                    <Shield size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">School Intranet Only</span>
                 </div>
                 <h4 className="text-xl font-bold mb-3 tracking-tight">Network Fence Active</h4>
                 <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                   All digital assets are streamed locally from the school server. These files are not synced to the public cloud for maximum security and privacy.
                 </p>
                 <div className="p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Status</p>
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        Online (Local)
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">IP Address</p>
                       <p className="text-sm font-mono text-zinc-400">192.168.1.10</p>
                    </div>
                 </div>
               </div>
               
               {/* Decorative background circle */}
               <div className="absolute -left-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronLeft({ className, size }: { className?: string, size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
