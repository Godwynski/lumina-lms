"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { SelfDeleteAccountDialog } from "@/components/account/SelfDeleteAccountDialog";
import { PolicyConfigurationForm } from "@/components/admin/PolicyConfigurationForm";
import { CategoryManagement } from "@/components/admin/CategoryManagement";
import { RecomputeExpiryDates } from "@/components/admin/RecomputeExpiryDates";
import { AuditLogViewer, GDPRHardDeleteDialog } from "@/components/admin/AuditAndGDPR";
import {
  User,
  SlidersHorizontal,
  Lock,
  Settings2,
  Tags,
  RefreshCw,
  ScrollText,
  Trash2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "admin" | "librarian" | "staff" | "student";

type PolicySetting = { id: string; key: string; value: string; description?: string };
type Category = { id: string; name: string; slug: string; description?: string; is_active: boolean };

interface Props {
  canManageSystem: boolean;
  isSuperAdmin: boolean;
  role: Role;
  profileName: string;
  avatarUrl: string;
  settings: PolicySetting[];
  categories: Category[];
}

const PERSONAL_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Update your personal details" },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal, description: "Notification and display settings" },
  { id: "security", label: "Security", icon: Lock, description: "Password and data privacy" },
] as const;

const ADMIN_TABS = [
  { id: "policies", label: "Policies", icon: Settings2, description: "Manage system-wide policies" },
  { id: "categories", label: "Categories", icon: Tags, description: "Book categories & genres" },
  { id: "operations", label: "Operations", icon: RefreshCw, description: "System maintenance tasks" },
  { id: "audit", label: "Audit Logs", icon: ScrollText, description: "Immutable system activity trail" },
  { id: "gdpr", label: "GDPR", icon: Trash2, description: "Profile anonymization & deletion" },
] as const;

type TabId =
  | (typeof PERSONAL_TABS)[number]["id"]
  | (typeof ADMIN_TABS)[number]["id"];

type NavTab = {
  id: TabId;
  label: string;
  description: string;
  icon: LucideIcon;
  section: "personal" | "admin";
};

export default function SettingsPageClient({ canManageSystem, isSuperAdmin, role, profileName, avatarUrl, settings, categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Personal settings state
  const [displayName, setDisplayName] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [savedMsg, setSavedMsg] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl || "");
  const [selectedPhotoBlob, setSelectedPhotoBlob] = useState<Blob | null>(null);
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadPrefs = async () => {
      setMounted(true);
      setDisplayName(profileName || "");

      try {
        const response = await fetch("/api/ui-preferences", { method: "GET" });
        if (response.ok) {
          const payload = (await response.json()) as {
            preferences?: {
              displayName?: string;
              emailAlerts?: boolean;
            };
          };
          const preferences = payload.preferences ?? {};
          if (typeof preferences.displayName === "string" && !profileName) {
            setDisplayName(preferences.displayName);
          }
          if (typeof preferences.emailAlerts === "boolean") {
            setEmailAlerts(preferences.emailAlerts);
          }
        }
      } catch {
        // Non-blocking: keep defaults
      }
    };

    void loadPrefs();
  }, [profileName]);

  useEffect(() => {
    const tab = searchParams.get("tab") as TabId | null;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const flash = useCallback((msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(""), 3000);
  }, []);

  const saveProfile = async () => {
    const nextName = displayName.trim();
    setProfileSaving(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nextName }),
      });

      const payload = (await response.json()) as { error?: string; avatar_url?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save profile");
      }

      await fetch("/api/ui-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nextName }),
      });
      flash("Profile saved successfully");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePreferences = async () => {
    try {
      const response = await fetch("/api/ui-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailAlerts,
        }),
      });
      if (!response.ok) throw new Error("Failed to save preferences");
      flash("Preferences updated");
    } catch {
      flash("Failed to save preferences");
    }
  };

  const clearLocalPreferences = async () => {
    setDisplayName("");
    setEmailAlerts(true);
    await fetch("/api/ui-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "",
        emailAlerts: true,
      }),
    });
    flash("Settings reset to defaults");
  };

  const changeTab = (id: TabId) => {
    setActiveTab(id);
    setMobileNavOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const uploadProfilePhoto = async () => {
    if (!selectedPhotoBlob) {
      flash("Select a photo first");
      return;
    }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      const uploadFile = new File([selectedPhotoBlob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" });
      formData.append("file", uploadFile);

      const response = await fetch("/api/profile-photo", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { error?: string; avatar_url?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Profile photo upload failed");
      }

      flash("Profile photo updated");
      if (payload.avatar_url) {
        setCurrentAvatarUrl(`${payload.avatar_url}${payload.avatar_url.includes("?") ? "&" : "?"}t=${Date.now()}`);
      }
      window.dispatchEvent(new Event("lumina:profile-photo-updated"));
      setSelectedPhotoName("");
      setSelectedPhotoBlob(null);
      if (selectedPhotoPreviewUrl) {
        URL.revokeObjectURL(selectedPhotoPreviewUrl);
        setSelectedPhotoPreviewUrl(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoSelected = async (file?: File) => {
    if (!file) {
      setSelectedPhotoName("");
      setSelectedPhotoBlob(null);
      if (selectedPhotoPreviewUrl) {
        URL.revokeObjectURL(selectedPhotoPreviewUrl);
        setSelectedPhotoPreviewUrl(null);
      }
      return;
    }

    try {
      const tempUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load image"));
        image.src = tempUrl;
      });

      const cropSize = Math.min(img.width, img.height);
      const sx = Math.floor((img.width - cropSize) / 2);
      const sy = Math.floor((img.height - cropSize) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(tempUrl);
        throw new Error("Image processing unavailable");
      }

      ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, 300, 300);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error("Unable to create preview"));
            return;
          }
          resolve(result);
        }, "image/jpeg", 0.92);
      });

      URL.revokeObjectURL(tempUrl);

      if (selectedPhotoPreviewUrl) {
        URL.revokeObjectURL(selectedPhotoPreviewUrl);
      }

      const nextPreviewUrl = URL.createObjectURL(blob);
      setSelectedPhotoBlob(blob);
      setSelectedPhotoName(file.name);
      setSelectedPhotoPreviewUrl(nextPreviewUrl);
    } catch (error) {
      setSelectedPhotoBlob(null);
      setSelectedPhotoName("");
      flash(error instanceof Error ? error.message : "Invalid image file");
    }
  };

  useEffect(() => {
    return () => {
      if (selectedPhotoPreviewUrl) {
        URL.revokeObjectURL(selectedPhotoPreviewUrl);
      }
    };
  }, [selectedPhotoPreviewUrl]);

  const visibleAdminTabs = useMemo(() => {
    if (!canManageSystem) return [] as Array<(typeof ADMIN_TABS)[number]>;
    if (isSuperAdmin) return ADMIN_TABS;
    return ADMIN_TABS.filter((tab) => tab.id === "policies" || tab.id === "categories");
  }, [canManageSystem, isSuperAdmin]);

  const allTabs = useMemo(() => {
    const personal: NavTab[] = PERSONAL_TABS.map((t) => ({ ...t, section: "personal" }));
    const admin: NavTab[] = canManageSystem
      ? visibleAdminTabs.map((t) => ({ ...t, section: "admin" }))
      : [];
    return [...personal, ...admin];
  }, [canManageSystem, visibleAdminTabs]);

  useEffect(() => {
    if (!allTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("profile");
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "profile");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [activeTab, allTabs, router]);

  const activeTabMeta = useMemo(() => allTabs.find((tab) => tab.id === activeTab), [activeTab, allTabs]);
  const hasPendingPhoto = !!selectedPhotoBlob;

  const handleMobilePhotoAction = () => {
    if (hasPendingPhoto) {
      void uploadProfilePhoto();
      return;
    }
    fileInputRef.current?.click();
  };

  if (!mounted) return null;

  return (
    <div className="w-full pb-24 md:pb-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 border-b border-border pb-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="border-border bg-muted text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {isSuperAdmin ? "Admin" : role}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1.5 text-base md:text-xl font-semibold tracking-tight text-foreground">
               <span className="text-muted-foreground/80">Settings</span>
               <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
               <span>{activeTabMeta?.label || "Profile Details"}</span>
            </div>
            <p className="text-sm text-muted-foreground">Manage profile, preferences, security, and system configuration.</p>
          </div>

        </div>
      </motion.div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[86%] max-w-xs border-r border-border bg-card p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="text-base">Settings navigation</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <SectionNav
              title="Personal"
              items={allTabs.filter((t) => t.section === "personal")}
              activeId={activeTab}
              onChange={changeTab}
            />

            {canManageSystem && (
              <SectionNav
                title="System Administration"
                items={allTabs.filter((t) => t.section === "admin")}
                activeId={activeTab}
                onChange={changeTab}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Toast banner ────────────────────────────────── */}
      <AnimatePresence>
        {savedMsg && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm"
          >
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {savedMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-4 lg:gap-6">
        {/* ── Main Panel ─────────────────────────────────── */}
        <main className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-5"
            >
              {activeTab === "profile" && (
                <Section key="profile" title="Profile Details" icon={User} onMobileNavClick={() => setMobileNavOpen(true)}>
                  <div className="grid gap-5">
                    <FieldGroup label="Display Name" description="How you appear across the system.">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Alex Rivera"
                        className="h-11 rounded-lg text-sm"
                      />
                    </FieldGroup>

                    <FieldGroup
                      label="Profile Photo"
                      description="Upload once to store a fixed 300x300 card photo. Future uploads replace the same file."
                    >
                      <div className="space-y-2 rounded-lg border border-border bg-muted p-3">
                        <div className="flex items-center gap-3 rounded-md border border-border bg-card p-2">
                          <Avatar className="h-12 w-12 rounded-md border border-border">
                            <AvatarImage src={currentAvatarUrl || undefined} alt={displayName || "Profile"} className="object-cover" />
                            <AvatarFallback className="rounded-md bg-muted text-sm font-semibold text-muted-foreground">
                              {(displayName || "U").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-xs font-semibold text-foreground">Current photo</p>
                            <p className="text-[11px] text-muted-foreground">New uploads replace this image.</p>
                          </div>
                        </div>

                        {selectedPhotoPreviewUrl && (
                          <div className="flex items-center gap-3 rounded-md border border-border bg-card p-2">
                            <Image
                              src={selectedPhotoPreviewUrl}
                              alt="Profile photo preview"
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded-md object-cover"
                            />
                            <p className="text-xs text-muted-foreground">Cropped preview (1:1, 300x300)</p>
                          </div>
                        )}
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => void handlePhotoSelected(e.target.files?.[0])}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mt-5 mb-1">
                          <Button
                            type="button"
                            variant="default"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-11 w-full sm:w-auto rounded-md px-3 text-sm font-semibold sm:px-4"
                          >
                            Choose Photo
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={uploadProfilePhoto}
                            disabled={photoUploading}
                            className="h-11 w-full sm:w-auto rounded-md px-4 text-sm font-semibold"
                          >
                            {photoUploading ? "Uploading..." : "Upload photo"}
                          </Button>
                          <p className="truncate text-xs text-muted-foreground text-center sm:text-left sm:ml-2">
                            {selectedPhotoName || "No file selected"}
                          </p>
                        </div>
                      </div>
                    </FieldGroup>

                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted p-3">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                          <UserCheck className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Current Role</p>
                          <p className="text-xs text-muted-foreground capitalize">{role}</p>
                        </div>
                      </div>
                      <Button
                        variant="default"
                        onClick={() => void saveProfile()}
                        disabled={profileSaving}
                        className="hidden h-11 rounded-lg px-6 font-semibold sm:inline-flex"
                      >
                        {profileSaving ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </div>
                </Section>
              )}

              {activeTab === "preferences" && (
                <Section key="preferences" title="Personalization" icon={SlidersHorizontal} onMobileNavClick={() => setMobileNavOpen(true)}>
                  <div className="space-y-3">
                    <PremiumToggle 
                      title="Intelligent Alerts" 
                      description="Receive smart notifications for due dates and library updates."
                      checked={emailAlerts}
                      onChange={setEmailAlerts}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="default" onClick={savePreferences} className="h-11 flex-1 rounded-lg sm:flex-none sm:px-6 font-semibold">
                      Save preferences
                    </Button>
                    <Button variant="outline" onClick={clearLocalPreferences} className="h-11 rounded-lg border-border text-muted-foreground font-semibold px-6">
                      Reset defaults
                    </Button>
                  </div>
                </Section>
              )}

              {activeTab === "security" && (
                <div key="security" className="space-y-5">
                  <Section title="Account Security" icon={Lock} onMobileNavClick={() => setMobileNavOpen(true)}>
                    <p className="mb-3 text-sm text-muted-foreground">Manage your authentication methods and login credentials.</p>
                    <Button asChild variant="outline" className="h-11 w-full gap-3 rounded-lg border-border sm:w-auto px-6 font-semibold">
                      <Link href="/auth/update-password">
                        <Lock size={16} />
                        Update password
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </Link>
                    </Button>
                  </Section>

                  <Section title="Privacy Control" icon={Trash2} danger>
                    <p className="mb-4 text-sm text-red-700/80">
                      Permanently anonymize your profile data. Once initiated, this action cannot be reversed under GDPR compliance.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={() => setDeleteDialogOpen(true)}
                      className="h-11 rounded-lg gap-3 bg-red-600 hover:bg-red-700 font-semibold px-6"
                    >
                      <Trash2 size={16} />
                      Request erasure
                    </Button>
                  </Section>
                </div>
              )}

              {/* Admin Views */}
              {activeTab === "policies" && canManageSystem && (
                <Section key="policies" title="Policy Control Center" icon={Settings2} onMobileNavClick={() => setMobileNavOpen(true)}>
                  <PolicyConfigurationForm settings={settings} canEdit={isSuperAdmin} />
                </Section>
              )}

              {activeTab === "categories" && canManageSystem && (
                <Section key="categories" title="Catalog Architecture" icon={Tags} onMobileNavClick={() => setMobileNavOpen(true)}>
                  <CategoryManagement initialCategories={categories} />
                </Section>
              )}

              {activeTab === "operations" && isSuperAdmin && (
                <div key="operations" className="space-y-4">
                  <Section title="Fleet Maintenance" icon={RefreshCw} onMobileNavClick={() => setMobileNavOpen(true)}>
                    <RecomputeExpiryDates />
                  </Section>
                </div>
              )}

              {activeTab === "audit" && isSuperAdmin && (
                <Section key="audit" title="System Transparency" icon={ScrollText} onMobileNavClick={() => setMobileNavOpen(true)}>
                  <Card className="mb-6 border-border bg-card shadow-sm">
                    <div className="flex items-start gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                        <AlertCircle size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Immutable Ledger</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Every transaction and administrative change is permanently hashed and recorded. Deletion or unauthorized modification is physically restricted at the database layer.
                        </p>
                      </div>
                    </div>
                  </Card>
                  <AuditLogViewer />
                </Section>
              )}

              {activeTab === "gdpr" && isSuperAdmin && (
                <Section key="gdpr" title="Right to Erasure" icon={Trash2} onMobileNavClick={() => setMobileNavOpen(true)} danger>
                  <Card className="mb-6 border-border bg-card shadow-sm">
                    <div className="p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-semibold text-foreground">Erasure Workflow</h4>
                      </div>
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <li className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 size={12} /> PII Scrubbing (Automatic)
                        </li>
                        <li className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 size={12} /> Transaction Preservation
                        </li>
                        <li className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 size={12} /> Audit Trail Mapping
                        </li>
                        <li className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 size={12} /> External Sync Cleanup
                        </li>
                      </ul>
                    </div>
                  </Card>
                  <GDPRHardDeleteDialog />
                </Section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>



      {activeTab === "profile" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleMobilePhotoAction}
              disabled={photoUploading}
              className="h-11 flex-1 rounded-lg border-border"
            >
              {photoUploading ? "Uploading..." : hasPendingPhoto ? "Upload photo" : "Choose photo"}
            </Button>
            <Button onClick={() => void saveProfile()} disabled={profileSaving} className="h-11 flex-1 rounded-lg">
              {profileSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      <SelfDeleteAccountDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

/* ── UI Components ───────────────────────────────────────── */

function SectionNav({
  title,
  items,
  activeId,
  onChange,
}: {
  title: string;
  items: NavTab[];
  activeId: TabId;
  onChange: (id: TabId) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-3">
        {items.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            onClick={() => onChange(id)}
            variant="ghost"
            className={cn(
              "relative h-11 w-full justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-all border-l-4",
              activeId === id ? "bg-primary/5 text-primary border-primary hover:bg-primary/10 shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted"
            )}
            aria-current={activeId === id ? "page" : undefined}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-all",
                activeId === id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"
              )}>
                <Icon size={15} />
              </div>
              <span>{label}</span>
            </div>
            {activeId === id && <div className="h-2 w-2 rounded-full bg-primary" aria-label="You are here" />}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, danger, onMobileNavClick }: { title: string; icon: LucideIcon; children: React.ReactNode; danger?: boolean; onMobileNavClick?: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <div className={cn("rounded-xl p-2", danger ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground")}>
          <Icon size={18} />
        </div>
        <h2 className={cn("flex-1 text-lg font-semibold tracking-tight", danger ? "text-red-900" : "text-foreground")}>{title}</h2>
        {onMobileNavClick && (
          <button onClick={onMobileNavClick} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted lg:hidden shadow-sm" aria-label="Browse sections">
            <ChevronDown size={14} />
          </button>
        )}
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">{children}</div>
    </div>
  );
}

function FieldGroup({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function PremiumToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onChange(!checked);
        }
      }}
      className="group flex w-full cursor-pointer items-center justify-between rounded-lg border-border bg-card p-4 text-left shadow-sm transition-all hover:border-border hover:bg-muted"
    >
      <div className="max-w-[75%]">
        <h4 className="text-sm font-semibold text-foreground transition-transform group-hover:translate-x-1">{title}</h4>
        <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} onClick={(e) => e.stopPropagation()} />
    </Card>
  );
}
