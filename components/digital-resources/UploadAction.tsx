"use client";

import { useState } from "react";
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
