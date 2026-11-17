"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { updateAvatarUrl, removeAvatar } from "@/lib/actions/profile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageCropper } from "./ImageCropper";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { bustAvatarCache } from "@/lib/utils/avatar-cache";
import { validateImageFile } from "@/lib/image-utils";

const MAX_AVATAR_MB = 5;

interface AvatarManagerProps {
  initialAvatarUrl: string | null;
  fullName: string | null;
}

export function AvatarManager({ initialAvatarUrl, fullName }: AvatarManagerProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { profile } = usePreferences();

  // Use the realtime profile avatar if available, otherwise fallback to initial
  const rawAvatarUrl = profile?.avatar_url ?? initialAvatarUrl;
  const avatarUrl = bustAvatarCache(rawAvatarUrl, profile?.updated_at);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check type and size before reading the file so an oversized photo never reaches the cropper.
    const validationError = validateImageFile(file, { maxMB: MAX_AVATAR_MB });
    if (validationError) {
      toast.error(validationError);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

      // 1. Upload the new cropped and resized blob
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // 3. Update Profile Table
      await updateAvatarUrl(publicUrl);

      // Keep card.webp: the server saves the processed profile picture there.
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(user.id);
      const filesToRemove = (existingFiles ?? [])
        .filter((f) => /^\d+\.jpg$/.test(f.name))
        .map((f) => `${user.id}/${f.name}`)
        .filter((p) => p !== filePath);
      if (filesToRemove.length > 0) {
        await supabase.storage.from("avatars").remove(filesToRemove);
      }

      router.refresh();
      toast.success("Profile picture updated.");
    } catch (error: unknown) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to update profile picture.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Remove your profile photo?")) return;
    try {
      setIsUploading(true);
      await removeAvatar();
      // Delete the uploaded photos; card.webp stays (the server owns it).
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: files } = await supabase.storage.from("avatars").list(user.id);
        const photos = (files ?? []).filter((f) => /^\d+\.jpg$/.test(f.name)).map((f) => `${user.id}/${f.name}`);
        if (photos.length > 0) await supabase.storage.from("avatars").remove(photos);
      }
      router.refresh();
      toast.success("Profile picture removed.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to remove profile picture.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/20 p-6 w-full sm:w-60 shrink-0 shadow-xs transition-colors hover:bg-muted/30 group/avatar">
      <div className="relative">
        <Avatar className="h-32 w-32 rounded-2xl border-4 border-background shadow-md transition-transform duration-500 group-hover/avatar:scale-[1.02]">
          <AvatarImage src={avatarUrl || undefined} alt={fullName || "Profile"} className="object-cover" />
          <AvatarFallback className="rounded-2xl bg-muted text-2xl font-bold text-muted-foreground">
            {(fullName || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Upload Overlay */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center bg-black/75 rounded-2xl opacity-0 group-hover/avatar:opacity-100 focus-visible:opacity-100 transition-all duration-300 backdrop-blur-[2px]",
            isUploading && "opacity-100 bg-black/60 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <><Loader2 className="h-8 w-8 text-white animate-spin" /><span className="sr-only">Uploading photo</span></>
          ) : (
            <>
              <Camera className="h-7 w-7 text-white mb-1" />
              <span className="text-xs font-semibold text-white">Change photo</span>
            </>
          )}
        </button>
      </div>
      
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-foreground">Profile Identity</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
        >
          {isUploading ? "Processing..." : "Click to update photo"}
        </button>
        {rawAvatarUrl && !isUploading && (
          <button
            type="button"
            onClick={() => void handleRemove()}
            className="block w-full text-xs text-muted-foreground font-medium hover:text-destructive hover:underline"
          >
            Remove photo
          </button>
        )}
      </div>

      <input 
        type="file"
        ref={fileInputRef}
        className="hidden"
        aria-label="Upload profile photo"
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
