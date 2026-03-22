"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const PDFViewer = dynamic(
  () => import("./PDFViewer").then((mod) => mod.PDFViewer),
  { 
    ssr: false,
    loading: () => (
      <Card className="h-full rounded-xl border-border bg-muted shadow-none">
        <CardContent className="flex h-full flex-col items-center justify-center p-20 text-muted-foreground">
          <Loader2 className="mb-4 animate-spin" size={32} />
          <p className="text-sm font-medium tracking-tight">Initializing Viewer...</p>
        </CardContent>
      </Card>
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
