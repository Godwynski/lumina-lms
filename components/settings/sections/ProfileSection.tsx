"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { User as UserIcon, UserCheck } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-utils";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Section, FieldGroup } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";

interface ProfileSectionProps {
  role: string;
  initialProfile: {
    full_name: string | null;
    avatar_url: string | null;
    address: string | null;
    phone: string | null;
  };
}

export function ProfileSection({ role, initialProfile }: ProfileSectionProps) {
  const { updatePreferences: updatePrefsContext } = usePreferences();
  
  const [displayName, setDisplayName] = useState(initialProfile.full_name || "");
  const [addressValue, setAddressValue] = useState(initialProfile.address || "");
  const [phoneValue, setPhoneValue] = useState(initialProfile.phone || "");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(initialProfile.avatar_url || "");
  
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [selectedPhotoBlob, setSelectedPhotoBlob] = useState<Blob | null>(null);
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isProfileDirty = 
    displayName !== (initialProfile.full_name || "") || 
    addressValue !== (initialProfile.address || "") || 
    phoneValue !== (initialProfile.phone || "");
  
  const isDirty = isProfileDirty || !!selectedPhotoBlob;

  const saveProfile = async () => {
    const nextName = displayName.trim();
    setProfileSaving(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          displayName: nextName,
          address: addressValue.trim(),
          phone: phoneValue.trim()
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to save profile");

      await updatePrefsContext({ displayName: nextName });
      toast.success("Profile saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

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
      setSelectedPhotoBlob(null);
      setSelectedPhotoName("");
      if (selectedPhotoPreviewUrl) URL.revokeObjectURL(selectedPhotoPreviewUrl);
      setSelectedPhotoPreviewUrl(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <SettingsShell isDirty={isDirty}>
      <Section title="Account Identity" icon={UserIcon} hideHeaderOnMobile>
        <div className="grid gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/40 p-4 sm:w-48">
              <Avatar className="h-24 w-24 rounded-xl border-2 border-background shadow-md">
                <AvatarImage src={currentAvatarUrl || undefined} alt={displayName || "Profile"} className="object-cover" />
                <AvatarFallback className="rounded-xl bg-muted text-lg font-bold">
                  {(displayName || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground">Profile Photo</p>
                <p className="text-[10px] text-muted-foreground">300x300 WebP</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:underline"
              >
                Change
              </button>
            </div>

            <div className="flex-1 space-y-4">
              <FieldGroup label="Display Name">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="h-10 rounded-lg text-sm"
                />
              </FieldGroup>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="Contact Number">
                  <Input
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    placeholder="+63 900 000 0000"
                    className="h-10 rounded-lg text-sm"
                  />
                </FieldGroup>

                <FieldGroup label="Residential Address">
                  <Input
                    value={addressValue}
                    onChange={(e) => setAddressValue(e.target.value)}
                    placeholder="Street, City, Province"
                    className="h-10 rounded-lg text-sm"
                  />
                </FieldGroup>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {selectedPhotoPreviewUrl && (
              <m.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="flex items-center justify-between border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-md border border-primary/30">
                      <Image src={selectedPhotoPreviewUrl} alt="Preview" fill className="object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary">Preview Ready</p>
                      <p className="text-[10px] text-primary/70">{selectedPhotoName}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePhotoSelected(undefined)}
                      className="h-8 text-xs text-muted-foreground"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={uploadProfilePhoto}
                      disabled={photoUploading}
                      className="h-8 text-xs"
                    >
                      {photoUploading ? "Uploading..." : "Save Photo"}
                    </Button>
                  </div>
                </Card>
              </m.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3 mt-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Current Membership</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{role}</p>
              </div>
            </div>
            <Button
              onClick={saveProfile}
              disabled={profileSaving || !isProfileDirty}
              className={cn("h-10 rounded-lg px-6 font-bold shadow-md transition-all")}
            >
              {profileSaving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
        />
      </Section>
    </SettingsShell>
  );
}
