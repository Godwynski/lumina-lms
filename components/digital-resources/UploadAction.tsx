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
      <Button className="bg-indigo-600/50 hover:bg-indigo-700/50 text-white rounded-xl h-11 shadow-md opacity-70 cursor-not-allowed">
        <Plus className="mr-2" size={18} />
        Upload Resource
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 shadow-md shadow-indigo-100 transition-all active:scale-95">
          <Plus className="mr-2" size={18} />
          Upload Resource
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 border-l border-zinc-200 overflow-y-auto">
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
