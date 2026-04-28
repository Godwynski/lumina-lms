"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { m, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-utils";

interface AvatarManagerProps {
  initialAvatarUrl: string | null;
  fullName: string | null;
}

export function AvatarManager({ initialAvatarUrl, fullName }: AvatarManagerProps) {
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(initialAvatarUrl || "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [selectedPhotoBlob, setSelectedPhotoBlob] = useState<Blob | null>(null);
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoSelected = async (file?: File) => {
    if (!file) {
      setSelectedPhotoName("");
      setSelectedPhotoBlob(null);
      if (selectedPhotoPreviewUrl) URL.revokeObjectURL(selectedPhotoPreviewUrl);
      setSelectedPhotoPreviewUrl(null);
      return;
    }

    try {
      setPhotoUploading(true);
      const blob = await compressImage(file, {
        maxDimension: 300,
        quality: 0.9,
        cropToSquare: true,
        type: "image/webp"
      });

      if (selectedPhotoPreviewUrl) URL.revokeObjectURL(selectedPhotoPreviewUrl);
      const nextPreviewUrl = URL.createObjectURL(blob);
      setSelectedPhotoBlob(blob);
      setSelectedPhotoName(file.name);
      setSelectedPhotoPreviewUrl(nextPreviewUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid image file");
    } finally {
      setPhotoUploading(false);
    }
  };

  const uploadProfilePhoto = async () => {
    if (!selectedPhotoBlob) return;
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", new File([selectedPhotoBlob], `profile.webp`, { type: "image/webp" }));

      const response = await fetch("/api/profile-photo", { method: "POST", body: formData });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error || "Profile photo upload failed");

      toast.success("Profile photo updated");
      if (payload.avatar_url) {
        setCurrentAvatarUrl(`${payload.avatar_url}?t=${Date.now()}`);
      }
      window.dispatchEvent(new Event("lumina:profile-photo-updated"));
      handlePhotoSelected(undefined); // Reset state
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-card/30 p-5 w-full sm:w-56 shadow-sm transition-all hover:bg-card/50">
      <Avatar className="h-28 w-28 rounded-2xl border-4 border-background shadow-md">
        <AvatarImage src={currentAvatarUrl || undefined} alt={fullName || "Profile"} className="object-cover" />
        <AvatarFallback className="rounded-2xl bg-muted text-xl font-bold">
          {(fullName || "U").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="text-center mt-2">
        <p className="text-xs font-black uppercase tracking-widest text-foreground/80">Profile Photo</p>
        <p className="text-[10px] text-muted-foreground/70 font-medium">300x300 WebP</p>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="mt-3 h-8 w-full rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-muted"
      >
        Change Photo
      </Button>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
      />

      <AnimatePresence>
        {selectedPhotoPreviewUrl && (
          <m.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="w-full overflow-hidden"
          >
            <Card className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-3 rounded-xl shadow-none">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-primary/30">
                  <Image src={selectedPhotoPreviewUrl} alt="Preview" fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary truncate">Preview Ready</p>
                  <p className="text-[9px] text-primary/70 truncate">{selectedPhotoName}</p>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePhotoSelected(undefined)}
                  className="h-8 flex-1 rounded-lg text-[10px] font-bold text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={uploadProfilePhoto}
                  disabled={photoUploading}
                  className="h-8 flex-1 rounded-lg text-[10px] font-bold"
                >
                  {photoUploading ? "Uploading..." : "Save"}
                </Button>
              </div>
            </Card>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
