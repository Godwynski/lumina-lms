"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  Search,
  CheckCircle2,
  Database,
  ShieldCheck,
  UserCheck,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

type Role = "admin" | "librarian" | "staff" | "student";

type PolicySetting = { id: string; key: string; value: string; description?: string };
type Category = { id: string; name: string; slug: string; description?: string; is_active: boolean };

interface Props {
  isAdmin: boolean;
  role: Role;
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

export default function SettingsPageClient({ isAdmin, role, settings, categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Personal settings state
  const [displayName, setDisplayName] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [compactTables, setCompactTables] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setDisplayName(localStorage.getItem("lumina_profile_name") || "");
    setEmailAlerts(localStorage.getItem("lumina_email_alerts") !== "false");
    setRememberDevice(localStorage.getItem("lumina_remember_device") !== "false");
    setCompactTables(localStorage.getItem("lumina_compact_tables") === "true");

    const tab = searchParams.get("tab") as TabId | null;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const flash = useCallback((msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(""), 3000);
  }, []);

  const saveProfile = () => {
    localStorage.setItem("lumina_profile_name", displayName.trim());
    flash("Profile saved successfully");
  };

  const savePreferences = () => {
    localStorage.setItem("lumina_email_alerts", String(emailAlerts));
    localStorage.setItem("lumina_remember_device", String(rememberDevice));
    localStorage.setItem("lumina_compact_tables", String(compactTables));
    flash("Preferences updated");
  };

  const clearLocalPreferences = () => {
    ["lumina_profile_name", "lumina_email_alerts", "lumina_remember_device", "lumina_compact_tables"]
      .forEach((k) => localStorage.removeItem(k));
    setDisplayName("");
    setEmailAlerts(true);
    setRememberDevice(true);
    setCompactTables(false);
    flash("Local settings reset to defaults");
  };

  const changeTab = (id: TabId) => {
    setActiveTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const uploadProfilePhoto = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      flash("Select a photo first");
      return;
    }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile-photo", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Profile photo upload failed");
      }

      flash("Profile photo updated");
      setSelectedPhotoName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const allTabs = useMemo(() => {
    const personal: NavTab[] = PERSONAL_TABS.map((t) => ({ ...t, section: "personal" }));
    const admin: NavTab[] = isAdmin
      ? ADMIN_TABS.map((t) => ({ ...t, section: "admin" }))
      : [];
    return [...personal, ...admin];
  }, [isAdmin]);

  const filteredTabs = useMemo(() => {
    if (!searchQuery) return allTabs;
    const query = searchQuery.toLowerCase();
    return allTabs.filter(tab => 
      tab.label.toLowerCase().includes(query) || 
      tab.description.toLowerCase().includes(query)
    );
  }, [allTabs, searchQuery]);

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-6xl pb-24 px-4 sm:px-6">
      {/* ── Premium Hero Profile ────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-10 h-72 w-full overflow-hidden rounded-[2.5rem] border border-white/20 bg-zinc-900 shadow-2xl"
      >
        <div className="absolute inset-0">
          <Image
            src="/images/settings-bg.png"
            alt="Profile Background"
            fill
            sizes="100vw"
            className="object-cover opacity-60 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/40 to-transparent" />
        </div>

        <div className="absolute inset-0 flex flex-col justify-end p-10 sm:p-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-white/10 text-white backdrop-blur-md border-white/20 px-3 py-1 font-mono uppercase tracking-[0.2em] text-[10px]">
                  {role}
                </Badge>
                {isAdmin && (
                  <Badge className="bg-indigo-500/20 text-indigo-300 backdrop-blur-md border-indigo-500/30 px-3 py-1 font-mono uppercase tracking-[0.2em] text-[10px]">
                    Root Access
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {displayName || "Unnamed Member"}
              </h1>
              <p className="max-w-md text-zinc-400 font-medium">
                Manage your profile, library preferences, and system-wide configurations.
              </p>
            </div>

            <div className="relative group min-w-[280px]">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-full rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:bg-white/10 focus:border-white/20 focus:ring-4 focus:ring-white/5 backdrop-blur-xl"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Toast banner ────────────────────────────────── */}
      <AnimatePresence>
        {savedMsg && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-2xl bg-zinc-900 px-6 py-4 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-xl"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {savedMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12 items-start">
        {/* ── Unified Navigation ─────────────────────────── */}
        <nav className="flex flex-col gap-10">
          <SectionNav 
            title="Personal" 
            items={filteredTabs.filter(t => t.section === 'personal')} 
            activeId={activeTab} 
            onChange={changeTab} 
          />
          
          {isAdmin && (
            <SectionNav 
              title="System Administration" 
              items={filteredTabs.filter(t => t.section === 'admin')} 
              activeId={activeTab} 
              onChange={changeTab} 
            />
          )}

          <div className="rounded-3xl bg-zinc-50 p-6 border border-zinc-100 hidden sm:block">
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">System Status</h4>
            <div className="space-y-4">
              <StatusIndicator icon={Zap} label="Performance" value="Optimal" color="text-emerald-600" />
              <StatusIndicator icon={ShieldCheck} label="Security" value="Protected" color="text-blue-600" />
              <StatusIndicator icon={Database} label="Storage" value="94% Free" color="text-zinc-600" />
            </div>
          </div>
        </nav>

        {/* ── Main Panel ─────────────────────────────────── */}
        <main className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-8"
            >
              {activeTab === "profile" && (
                <Section key="profile" title="Profile Details" icon={User}>
                  <div className="grid gap-8">
                    <FieldGroup label="Display Name" description="How you appear across the system.">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Alex Rivera"
                        className="h-12 rounded-xl text-md"
                      />
                    </FieldGroup>

                    <FieldGroup
                      label="Profile Photo"
                      description="Upload once to store a fixed 300x300 card photo. Future uploads replace the same file."
                    >
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 space-y-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
                          onChange={(e) => setSelectedPhotoName(e.target.files?.[0]?.name || "")}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-zinc-500 truncate">
                            {selectedPhotoName || "No file selected"}
                          </p>
                          <Button
                            type="button"
                            onClick={uploadProfilePhoto}
                            disabled={photoUploading}
                            className="rounded-xl h-10 px-5 bg-indigo-600 hover:bg-indigo-700"
                          >
                            {photoUploading ? "Uploading..." : "Upload Photo"}
                          </Button>
                        </div>
                      </div>
                    </FieldGroup>

                    <div className="flex items-center justify-between p-6 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center border border-zinc-200 shadow-sm">
                          <UserCheck className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">Current Role</p>
                          <p className="text-xs text-zinc-500 capitalize">{role}</p>
                        </div>
                      </div>
                      <Button onClick={saveProfile} className="rounded-xl h-11 px-8 bg-indigo-600 hover:bg-indigo-700">
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </Section>
              )}

              {activeTab === "preferences" && (
                <Section key="preferences" title="Personalization" icon={SlidersHorizontal}>
                  <div className="space-y-4">
                    <PremiumToggle 
                      title="Intelligent Alerts" 
                      description="Receive smart notifications for due dates and library updates."
                      checked={emailAlerts}
                      onChange={setEmailAlerts}
                    />
                    <PremiumToggle 
                      title="Fast Login" 
                      description="Remember this device for a seamless authentication experience."
                      checked={rememberDevice}
                      onChange={setRememberDevice}
                    />
                    <PremiumToggle 
                      title="Pro Mode Layout" 
                      description="Use compact tables and condensed layouts for high efficiency."
                      checked={compactTables}
                      onChange={setCompactTables}
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-4">
                    <Button onClick={savePreferences} className="rounded-xl h-11 flex-1 sm:flex-none sm:px-10 bg-indigo-600">
                      Sync Preferences
                    </Button>
                    <Button variant="outline" onClick={clearLocalPreferences} className="rounded-xl h-11 border-zinc-200 text-zinc-600">
                      Restore Defaults
                    </Button>
                  </div>
                </Section>
              )}

              {activeTab === "security" && (
                <div key="security" className="space-y-8">
                  <Section title="Account Security" icon={Lock}>
                    <p className="text-sm text-zinc-600 mb-6">Manage your authentication methods and login credentials.</p>
                    <a href="/auth/update-password">
                      <Button variant="outline" className="w-full sm:w-auto h-12 rounded-xl border-zinc-200 gap-3">
                        <Lock size={16} />
                        Update Password
                        <ChevronRight size={16} className="text-zinc-400" />
                      </Button>
                    </a>
                  </Section>

                  <Section title="Privacy Control" icon={Trash2} danger>
                    <p className="text-sm text-red-700/80 mb-6">
                      Permanently anonymize your profile data. Once initiated, this action cannot be reversed under GDPR compliance.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={() => setDeleteDialogOpen(true)}
                      className="rounded-xl h-12 gap-3 bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 size={16} />
                      Erasure Request
                    </Button>
                  </Section>
                </div>
              )}

              {/* Admin Views */}
              {activeTab === "policies" && isAdmin && (
                <Section key="policies" title="Policy Control Center" icon={Settings2}>
                  <PolicyConfigurationForm settings={settings} />
                </Section>
              )}

              {activeTab === "categories" && isAdmin && (
                <Section key="categories" title="Catalog Architecture" icon={Tags}>
                  <CategoryManagement initialCategories={categories} />
                </Section>
              )}

              {activeTab === "operations" && isAdmin && (
                <div key="operations" className="space-y-8">
                  <Section title="Fleet Maintenance" icon={RefreshCw}>
                    <RecomputeExpiryDates />
                  </Section>

                  <Card className="overflow-hidden rounded-3xl border-blue-100 bg-blue-50/50 p-8 shadow-none group">
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                        <Database className="text-white h-7 w-7" />
                      </div>
                      <div className="space-y-4 flex-1">
                        <div>
                          <h3 className="text-lg font-bold text-blue-900">Active Directory Synchronization</h3>
                          <p className="text-sm text-blue-700/70 mt-1">Microsoft Graph API Integration for automated graduation data processing.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <code className="px-3 py-1 bg-blue-100 rounded-lg text-xs font-mono text-blue-800">/admin/graduation-sync</code>
                          <Badge variant="secondary" className="bg-blue-200/50 text-blue-800 border-none">Ready</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "audit" && isAdmin && (
                <Section key="audit" title="System Transparency" icon={ScrollText}>
                  <div className="rounded-3xl bg-amber-50/50 border border-amber-100 p-6 flex gap-4 text-amber-900 mb-8 items-start">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertCircle size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold">Immutable Ledger</p>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Every transaction and administrative change is permanently hashed and recorded. Deletion or unauthorized modification is physically restricted at the database layer.
                      </p>
                    </div>
                  </div>
                  <AuditLogViewer />
                </Section>
              )}

              {activeTab === "gdpr" && isAdmin && (
                <Section key="gdpr" title="Right to Erasure" icon={Trash2} danger>
                  <div className="rounded-3xl bg-indigo-50/50 border border-indigo-100 p-6 mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <ShieldCheck className="text-indigo-600 h-5 w-5" />
                      <h4 className="text-sm font-bold text-indigo-900">Erasure Workflow</h4>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <li className="flex items-center gap-2 text-xs text-indigo-700">
                        <CheckCircle2 size={12} /> PII Scrubbing (Automatic)
                      </li>
                      <li className="flex items-center gap-2 text-xs text-indigo-700">
                        <CheckCircle2 size={12} /> Transaction Preservation
                      </li>
                      <li className="flex items-center gap-2 text-xs text-indigo-700">
                        <CheckCircle2 size={12} /> Audit Trail Mapping
                      </li>
                      <li className="flex items-center gap-2 text-xs text-indigo-700">
                        <CheckCircle2 size={12} /> External Sync Cleanup
                      </li>
                    </ul>
                  </div>
                  <GDPRHardDeleteDialog />
                </Section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

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
  onChange 
}: { 
  title: string; 
  items: NavTab[];
  activeId: TabId;
  onChange: (id: TabId) => void;
}) {
  if (items.length === 0) return null;
  
  return (
    <div className="space-y-4">
      <h3 className="px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
        {title}
      </h3>
      <div className="flex flex-col gap-1">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="group relative flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 outline-none"
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 ${
                activeId === id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105" 
                  : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-900"
              }`}>
                <Icon size={18} />
              </div>
              <span className={activeId === id ? "text-indigo-900" : "text-zinc-500 group-hover:text-zinc-900"}>
                {label}
              </span>
            </div>
            
            {activeId === id && (
              <motion.div 
                layoutId="active-pill"
                className="absolute inset-0 z-0 rounded-2xl bg-indigo-50 border border-indigo-100/50 shadow-sm"
              />
            )}
            
            {activeId === id && <ChevronRight size={14} className="text-indigo-400 relative z-10" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, danger }: { title: string; icon: LucideIcon; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 pb-4 border-b border-zinc-100">
        <div className={`p-2 rounded-xl ${danger ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"}`}>
          <Icon size={20} />
        </div>
        <h2 className={`text-2xl font-bold tracking-tight ${danger ? "text-red-900" : "text-zinc-900"}`}>
          {title}
        </h2>
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {children}
      </div>
    </div>
  );
}

function FieldGroup({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-base font-bold text-zinc-900 block">{label}</label>
        {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function PremiumToggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full p-6 text-left rounded-[2rem] bg-zinc-50/50 border border-zinc-100 hover:bg-zinc-50 hover:border-zinc-200 transition-all group"
    >
      <div className="max-w-[75%]">
        <h4 className="text-sm font-bold text-zinc-900 group-hover:translate-x-1 transition-transform">{title}</h4>
        <p className="text-xs text-zinc-500 mt-1">{description}</p>
      </div>
      <div className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-300 focus:outline-none ${checked ? "bg-indigo-600" : "bg-zinc-200"}`}>
        <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 translate-y-1 ${checked ? "translate-x-7" : "translate-x-1"}`} />
      </div>
    </button>
  );
}

function StatusIndicator({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon size={14} className="text-zinc-400" />
        <span className="text-xs font-bold text-zinc-500">{label}</span>
      </div>
      <span className={`text-[10px] font-black uppercase tracking-wider ${color}`}>{value}</span>
    </div>
  );
}
