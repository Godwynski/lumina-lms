"use client";

import { useEffect, useState, useMemo, useRef, memo, useCallback, use, Suspense } from "react";

import Link from "next/link";
import Image from "next/image";
import { type User as SupabaseUser } from "@supabase/supabase-js";
import { m, AnimatePresence } from "framer-motion";
import { SelfDeleteAccountDialog } from "@/components/account/SelfDeleteAccountDialog";
import { PolicyConfigurationForm } from "@/components/admin/PolicyConfigurationForm";
import { CategoryManagement } from "@/components/admin/CategoryManagement";
import { RecomputeExpiryDates } from "@/components/admin/RecomputeExpiryDates";
import {
  User as UserIcon,
  SlidersHorizontal,
  Lock,
  Settings2,
  Tags,
  RefreshCw,
  Trash2,
  ChevronRight,
  ChevronDown,
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
import { toast } from "sonner";
import { NavigationGuard } from "@/components/layout/NavigationGuard";
import { compressImage } from "@/lib/image-utils";
import { usePreferences } from "@/components/providers/PreferencesProvider";

type Role = "admin" | "librarian" | "staff" | "student";

type PolicySetting = { id: string; key: string; value: string; description?: string };
type Category = { id: string; name: string; slug: string; description?: string; is_active: boolean };

interface Profile {
  role: string | null;
  full_name: string | null;
  avatar_url: string | null;
  address: string | null;
  phone: string | null;
}

interface Props {
  user: SupabaseUser; 
  profilePromise: Promise<Profile | null>;
  settingsPromise: Promise<PolicySetting[]>;
  categoriesPromise: Promise<Category[]>;
  initialTab?: TabId;
}

const PERSONAL_TABS = [
  { id: "profile", label: "Profile", icon: UserIcon, description: "Update your personal details" },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal, description: "Notification and display settings" },
  { id: "security", label: "Security", icon: Lock, description: "Password and data privacy" },
] as const;

const ADMIN_TABS = [
  { id: "policies", label: "Policies", icon: Settings2, description: "Manage system-wide policies" },
  { id: "categories", label: "Categories", icon: Tags, description: "Book categories & genres" },
  { id: "operations", label: "Operations", icon: RefreshCw, description: "System maintenance tasks" },
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

export default function SettingsPageClient({ profilePromise, settingsPromise, categoriesPromise, initialTab }: Props) {
  const profile = use(profilePromise);
  
  const role = (profile?.role as Role) || "student";
  const canManageSystem = role === "admin" || role === "librarian";
  const isSuperAdmin = role === "admin";
  const profileName = typeof profile?.full_name === "string" ? profile.full_name : "";
  const avatarUrl = typeof profile?.avatar_url === "string" ? profile.avatar_url : "";
  const address = typeof profile?.address === "string" ? profile.address : "";
  const phone = typeof profile?.phone === "string" ? profile.phone : "";


  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || "profile");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Personal settings state
  const [displayName, setDisplayName] = useState("");
  const [addressValue, setAddressValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl || "");
  const [selectedPhotoBlob, setSelectedPhotoBlob] = useState<Blob | null>(null);
  const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [intelligentAlerts, setIntelligentAlerts] = useState(true);

  // Dirty tracking
  const [initialData, setInitialData] = useState({
    displayName: "",
    address: "",
    phone: "",
    intelligentAlerts: true
  });

  const { preferences, updatePreferences: updatePrefsContext } = usePreferences();

  useEffect(() => {
    setMounted(true);
    const nameVal = profileName || "";
    const addrVal = address || "";
    const phoneVal = phone || "";
    
    setDisplayName(nameVal);
    setAddressValue(addrVal);
    setPhoneValue(phoneVal);

    if (preferences) {
      if (typeof preferences.displayName === "string" && !profileName) {
        setDisplayName(preferences.displayName);
      }
      if (typeof preferences.intelligentAlerts === "boolean") {
        setIntelligentAlerts(preferences.intelligentAlerts);
        setInitialData(prev => ({ ...prev, intelligentAlerts: preferences.intelligentAlerts as boolean }));
      }
    }
  }, [profileName, address, phone, preferences]);

  useEffect(() => {
    setInitialData(prev => ({
      ...prev,
      displayName: profileName || "",
      address: address || "",
      phone: phone || "",
    }));
  }, [profileName, address, phone]);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, activeTab]);

  const isProfileDirty = 
    displayName !== initialData.displayName || 
    addressValue !== initialData.address || 
    phoneValue !== initialData.phone;
  
  const isPrefsDirty = intelligentAlerts !== initialData.intelligentAlerts;
  const isDirty = isProfileDirty || isPrefsDirty || !!selectedPhotoBlob;

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

      const payload = (await response.json()) as { error?: string; avatar_url?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save profile");
      }

      await updatePrefsContext({ displayName: nextName });
      
      setInitialData(prev => ({ 
        ...prev, 
        displayName: nextName, 
        address: addressValue.trim(), 
        phone: phoneValue.trim() 
      }));
      toast.success("Profile saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const savePreferences = async () => {
    try {
      await updatePrefsContext({ intelligentAlerts });
      setInitialData(prev => ({ ...prev, intelligentAlerts }));
      toast.success("Preferences updated");
    } catch {
      toast.error("Failed to save preferences");
    }
  };

  const clearLocalPreferences = async () => {
    const defaultName = "";
    const defaultAlerts = true;
    setDisplayName(defaultName);
    setIntelligentAlerts(defaultAlerts);
    await updatePrefsContext({
      displayName: defaultName,
      intelligentAlerts: defaultAlerts,
    });
    setInitialData(prev => ({ ...prev, displayName: defaultName, intelligentAlerts: defaultAlerts }));
    toast.success("Settings reset to defaults");
  };

  const changeTab = useCallback((id: TabId) => {
    setActiveTab(id);
    setMobileNavOpen(false);
  }, []);

  const uploadProfilePhoto = async () => {
    if (!selectedPhotoBlob) {
      toast.error("Select a photo first");
      return;
    }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      const uploadFile = new File([selectedPhotoBlob], `profile-${Date.now()}.webp`, { type: "image/webp" });
      formData.append("file", uploadFile);

      const response = await fetch("/api/profile-photo", {
        method: "POST",
        body: formData,
      });

      let payload: { error?: string; avatar_url?: string };
      try {
        payload = await response.json();
      } catch {
        if (response.status === 413) {
          throw new Error("Image is too large. Even after compression, it exceeds limits.");
        }
        throw new Error(`Upload failed (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(payload.error || "Profile photo upload failed");
      }

      toast.success("Profile photo updated");
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
      toast.error(error instanceof Error ? error.message : "Upload failed");
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
      setPhotoUploading(true);
      const blob = await compressImage(file, {
        maxDimension: 300,
        quality: 0.9,
        cropToSquare: true,
        type: "image/webp"
      });

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
      toast.error(error instanceof Error ? error.message : "Invalid image file");
    } finally {
      setPhotoUploading(false);
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
    }
  }, [activeTab, allTabs]);

  const activeTabMeta = useMemo(() => allTabs.find((tab) => tab.id === activeTab), [activeTab, allTabs]);

  const setIntelligentAlertsValue = useCallback((v: boolean) => setIntelligentAlerts(v), []);
  const onMobileNavClick = useCallback(() => setMobileNavOpen(true), []);

  if (!mounted) return null;

  return (
    <div className="w-full pb-20 md:pb-8">
      <NavigationGuard isDirty={isDirty} />
      <m.div
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
               <span>{activeTabMeta?.label || "Profile Details"}</span>
            </div>
            <p className="text-sm text-muted-foreground">{activeTabMeta?.description || "Manage your settings and configuration."}</p>
          </div>
        </div>
      </m.div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[86%] max-w-xs border-r border-border bg-card p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="text-base">Navigation</SheetTitle>
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

      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-4 lg:gap-6">
        <main className="min-w-0">
          <AnimatePresence mode="wait">
            <m.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "profile" && (
                <Section key="profile" title="Account Identity" icon={UserIcon} onMobileNavClick={onMobileNavClick}>
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

                    {selectedPhotoPreviewUrl && (
                      <Card className="flex items-center justify-between border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 overflow-hidden rounded-md border border-primary/30">
                            <Image
                              src={selectedPhotoPreviewUrl}
                              alt="Profile photo preview"
                              fill
                              className="object-cover"
                            />
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
                            onClick={() => {
                              setSelectedPhotoBlob(null);
                              setSelectedPhotoName("");
                              setSelectedPhotoPreviewUrl(null);
                            }}
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
                    )}

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
                        onClick={() => void saveProfile()}
                        disabled={profileSaving || !isProfileDirty}
                        className={cn(
                          "h-10 rounded-lg px-6 font-bold shadow-md transition-all",
                          isProfileDirty ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground opacity-50"
                        )}
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
                    onChange={(e) => void handlePhotoSelected(e.target.files?.[0])}
                  />
                </Section>
              )}

              {activeTab === "preferences" && (
                <Section key="preferences" title="Library Experience" icon={SlidersHorizontal} onMobileNavClick={onMobileNavClick}>
                  <div className="space-y-3">
                    <PremiumToggle 
                      title="Intelligent Alerts" 
                      description="Receive smart notifications for due dates and library updates."
                      checked={intelligentAlerts}
                      onChange={setIntelligentAlertsValue}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <Button 
                      variant="default" 
                      onClick={savePreferences} 
                      disabled={!isPrefsDirty}
                      className={cn(
                        "h-10 flex-1 rounded-lg sm:flex-none sm:px-8 font-bold shadow-md",
                        !isPrefsDirty && "opacity-50"
                      )}
                    >
                      Save Preferences
                    </Button>
                    <Button variant="outline" onClick={clearLocalPreferences} className="h-10 rounded-lg border-border text-muted-foreground font-bold px-6">
                      Reset Defaults
                    </Button>
                  </div>
                </Section>
              )}

              {activeTab === "security" && (
                <div key="security" className="space-y-5">
                  <Section title="Account Security" icon={Lock} onMobileNavClick={onMobileNavClick}>
                    <p className="mb-3 text-sm text-muted-foreground">Manage your authentication methods and login credentials.</p>
                    <Button asChild variant="outline" className="h-11 w-full gap-3 rounded-lg border-border sm:w-auto px-6 font-semibold shadow-sm">
                      <Link href="/auth/update-password">
                        <Lock size={16} />
                        Update password
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </Link>
                    </Button>
                  </Section>

                  <Section title="Privacy Control" icon={Trash2} danger>
                    <p className="mb-4 text-sm text-red-700/80 leading-relaxed">
                      Permanently delete your profile. Note that some transaction history and library logs will be kept for compliance and record-keeping.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={() => setDeleteDialogOpen(true)}
                      className="h-10 rounded-lg gap-3 bg-red-600 hover:bg-red-700 font-bold px-6 shadow-sm"
                    >
                      <Trash2 size={16} />
                      Permanently Delete My Account
                    </Button>
                  </Section>
                </div>
              )}

              {/* Admin Views */}
              {activeTab === "policies" && canManageSystem && (
                <Section key="policies" title="Policy Control Center" icon={Settings2} onMobileNavClick={onMobileNavClick}>
                  <Suspense fallback={<div className="h-32 w-full animate-pulse bg-muted rounded-xl" />}>
                     <PolicyStreamWrapper promise={settingsPromise} canEdit={isSuperAdmin} />
                  </Suspense>
                </Section>
              )}

              {activeTab === "categories" && canManageSystem && (
                <Section key="categories" title="Catalog Architecture" icon={Tags} onMobileNavClick={onMobileNavClick}>
                   <Suspense fallback={<div className="h-32 w-full animate-pulse bg-muted rounded-xl" />}>
                     <CategoryStreamWrapper promise={categoriesPromise} />
                   </Suspense>
                </Section>
              )}

              {activeTab === "operations" && isSuperAdmin && (
                <div key="operations" className="space-y-4">
                  <Section title="Fleet Maintenance" icon={RefreshCw} onMobileNavClick={onMobileNavClick}>
                    <RecomputeExpiryDates />
                  </Section>
                </div>
              )}


              {/* Anonymization tools removed */}
            </m.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {activeTab === "profile" && isProfileDirty && (
          <m.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden"
          >
            <div className="mx-auto flex max-w-3xl gap-2">
              <Button onClick={() => void saveProfile()} disabled={profileSaving} className="h-11 flex-1 rounded-lg font-bold shadow-lg">
                {profileSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDisplayName(initialData.displayName);
                  setAddressValue(initialData.address);
                  setPhoneValue(initialData.phone);
                }}
                className="h-11 flex-1 rounded-lg font-bold border-border"
              >
                Discard
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <SelfDeleteAccountDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

/* ── Streaming Wrappers ───────────────────────────────────── */

function PolicyStreamWrapper({ promise, canEdit }: { promise: Promise<PolicySetting[]>, canEdit: boolean }) {
  const data = use(promise);
  return <PolicyConfigurationForm settings={data} canEdit={canEdit} />;
}

function CategoryStreamWrapper({ promise }: { promise: Promise<Category[]> }) {
  const data = use(promise);
  return <CategoryManagement initialCategories={data} />;
}

/* ── UI Components ───────────────────────────────────────── */

const SectionNav = memo(({
  title,
  items,
  activeId,
  onChange,
}: {
  title: string;
  items: NavTab[];
  activeId: TabId;
  onChange: (id: TabId) => void;
}) => {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-1">
        {items.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            asChild
            variant="ghost"
            className={cn(
              "relative h-10 w-full justify-start rounded-lg px-3 py-2 text-sm font-semibold transition-all",
              activeId === id ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => onChange(id)}
            aria-current={activeId === id ? "page" : undefined}
          >
            <Link href={`/${id}`} scroll={false}>
              <Icon size={16} className="mr-3" />
              <span>{label}</span>
              {activeId === id && <m.div layoutId="nav-indicator" className="absolute left-0 w-1 h-5 bg-primary rounded-r-full" />}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
});
SectionNav.displayName = "SectionNav";

const Section = memo(({ title, icon: Icon, children, danger, onMobileNavClick }: { title: string; icon: LucideIcon; children: React.ReactNode; danger?: boolean; onMobileNavClick?: () => void }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <div className={cn("rounded-lg p-1.5", danger ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground")}>
          <Icon size={16} />
        </div>
        <h2 className={cn("flex-1 text-base font-bold tracking-tight", danger ? "text-red-900" : "text-foreground")}>{title}</h2>
        {onMobileNavClick && (
          <button onClick={onMobileNavClick} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted lg:hidden shadow-sm" aria-label="Browse sections">
            <ChevronDown size={14} />
          </button>
        )}
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-400">{children}</div>
    </div>
  );
});
Section.displayName = "Section";

const FieldGroup = memo(({ label, children }: { label: string; children: React.ReactNode }) => {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold text-foreground/80">{label}</Label>
      {children}
    </div>
  );
});
FieldGroup.displayName = "FieldGroup";

const PremiumToggle = memo(({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) => {
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
      className="group flex w-full cursor-pointer items-center justify-between rounded-xl border-border bg-card p-4 text-left shadow-sm transition-all hover:bg-muted/50"
    >
      <div className="max-w-[80%]">
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-normal">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} onClick={(e) => e.stopPropagation()} />
    </Card>
  );
});
PremiumToggle.displayName = "PremiumToggle";
