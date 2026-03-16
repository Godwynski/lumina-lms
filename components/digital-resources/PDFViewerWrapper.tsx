"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const PDFViewer = dynamic(
  () => import("./PDFViewer").then((mod) => mod.PDFViewer),
  { 
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center p-20 text-indigo-500/50 bg-zinc-100 h-full rounded-3xl border border-zinc-200">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p className="text-sm font-medium tracking-tight">Initializing Viewer...</p>
      </div>
    )
  }
);

interface PDFViewerWrapperProps {
  resourceId: string;
  fileUrl: string;
  title: string;
}

export default function PDFViewerWrapper(props: PDFViewerWrapperProps) {
  return <PDFViewer {...props} />;
}
