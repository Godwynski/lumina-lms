"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UploadInterface } from "./UploadInterface";

interface UploadActionProps {
  categories: { id: string; name: string }[];
}

export function UploadAction({ categories }: UploadActionProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by waiting for client mounting
  // This is necessary because Radix UI generates random IDs for accessibility
  // which can differ between server and client rendering.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button className="h-11 cursor-not-allowed rounded-xl bg-primary/50 text-primary-foreground opacity-70">
        <Plus className="mr-2" size={18} />
        Upload Resource
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="h-11 rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-95">
          <Plus className="mr-2" size={18} />
          Upload Resource
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-border p-0 sm:max-w-xl">
        <div className="p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold tracking-tight">Upload Resource</SheetTitle>
            <SheetDescription>
              Add new digital assets to the school catalog. These files are stored locally.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <UploadInterface 
              categories={categories} 
              onUploadSuccess={() => setOpen(false)} 
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
