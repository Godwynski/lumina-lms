"use client";

import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { updateAvatarUrl } from "@/lib/actions/profile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageCropper } from "./ImageCropper";
import { usePreferences } from "@/components/providers/PreferencesProvider";

interface AvatarManagerProps {
  initialAvatarUrl: string | null;
  fullName: string | null;
}

export function AvatarManager({ initialAvatarUrl, fullName }: AvatarManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { profile } = usePreferences();

  // Use the realtime profile avatar if available, otherwise fallback to initial
  const avatarUrl = profile?.avatar_url ?? initialAvatarUrl;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTempImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Reset input value so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setTempImage(null);
    
    try {
      setIsUploading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Delete existing files in the user's avatar directory to save space
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(user.id);
        
      if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles.map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(filesToRemove);
      }

      // 2. Upload the new cropped and resized blob
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // 4. Update Profile Table
      await updateAvatarUrl(publicUrl);

      toast.success("Profile picture updated.");
    } catch (error: unknown) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to update profile picture.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-border/40 bg-card/30 p-6 w-full sm:w-64 shadow-sm transition-all hover:bg-card/40 group/avatar">
      <div className="relative">
        <Avatar className="h-32 w-32 rounded-3xl border-4 border-background shadow-xl transition-transform duration-500 group-hover/avatar:scale-[1.02]">
          <AvatarImage src={avatarUrl || undefined} alt={fullName || "Profile"} className="object-cover" />
          <AvatarFallback className="rounded-3xl bg-muted text-2xl font-black text-muted-foreground/50">
            {(fullName || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Upload Overlay */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-3xl opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 backdrop-blur-[2px]",
            isUploading && "opacity-100 bg-black/60 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <>
              <Camera className="h-8 w-8 text-white mb-1" />
              <span className="text-[10px] font-black uppercase tracking-tighter text-white">Change Photo</span>
            </>
          )}
        </button>
      </div>
      
      <div className="text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/80 mb-1">Profile Identity</p>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-[10px] text-primary font-bold hover:underline disabled:opacity-50"
        >
          {isUploading ? "Processing..." : "Click to update photo"}
        </button>
      </div>

      <input 
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileSelect}
      />

      {tempImage && (
        <ImageCropper 
          image={tempImage} 
          onCropComplete={handleCropComplete} 
          onCancel={() => setTempImage(null)} 
        />
      )}
    </div>
  );
}
