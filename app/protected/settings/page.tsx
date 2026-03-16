"use client";

import {
  Settings2,
  RotateCcw,
  Zap,
  Users,
  ShieldCheck,
  Search,
  ArrowRight,
  UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

// This would normally come from an auth hook, keeping it simple for the UI logic
type Role = "admin" | "librarian" | "staff" | "student";

export default function SettingsPage() {
  const [sidebarMemory, setSidebarMemory] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<Role>("admin"); // Default to admin for UI development

  useEffect(() => {
    setMounted(true);
    const mem = localStorage.getItem("lumina_sidebar_expanded");
    const focus = localStorage.getItem("lumina_sidebar_auto_collapse");
    setSidebarMemory(mem !== null); 
    setFocusMode(focus === "true");
  }, []);

  const toggleSidebarMemory = () => {
    const newValue = !sidebarMemory;
    setSidebarMemory(newValue);
    if (!newValue) {
      localStorage.removeItem("lumina_sidebar_expanded");
    } else {
      localStorage.setItem("lumina_sidebar_expanded", JSON.stringify({}));
    }
  };

  const toggleFocusMode = () => {
    const newValue = !focusMode;
    setFocusMode(newValue);
    localStorage.setItem("lumina_sidebar_auto_collapse", String(newValue));
    window.dispatchEvent(new Event("storage"));
  };

  const resetNav = () => {
    localStorage.removeItem("lumina_sidebar_expanded");
    localStorage.removeItem("lumina_sidebar_auto_collapse");
    setSidebarMemory(true);
    setFocusMode(false);
    window.dispatchEvent(new Event("storage"));
    alert("Navigation preferences reset to default.");
  };

  if (!mounted) return null;

  const isAdmin = role === "admin";
  const isLibrarian = role === "librarian" || isAdmin;
  const isStaff = role === "staff" || isLibrarian;

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Settings Hub</h1>
        <p className="text-zinc-500 mt-1">Configure your experience and manage system resources.</p>
      </div>

      <div className="grid gap-10">
        {/* MANAGEMENT SECTION - Only for Admin/Librarian/Staff */}
        {isStaff && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Users size={18} className="text-indigo-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Management</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ManagementCard 
                href="/protected/users"
                title="Users & Roles"
                description="Manage library staff, students, and their access permissions."
                icon={Users}
              />
              {isLibrarian && (
                <ManagementCard 
                  href="/protected/admin/approvals"
                  title="Card Approvals"
                  description="Review and approve new library card applications."
                  icon={UserCheck}
                />
              )}
            </div>
          </section>
        )}

        {/* SECURITY & DATA - Only for Admins */}
        {isAdmin && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <ShieldCheck size={18} className="text-indigo-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">System & Security</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ManagementCard 
                href="/protected/audit"
                title="Audit Logs"
                description="View a detailed history of all system events and user actions."
                icon={Search}
              />
            </div>
          </section>
        )}

        {/* INTERFACE PREFERENCES */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Settings2 size={18} className="text-indigo-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Interface Preferences</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PreferenceToggle 
              isActive={sidebarMemory}
              onToggle={toggleSidebarMemory}
              title="Sidebar Memory"
              description="Remember which modules you have expanded between sessions."
              icon={RotateCcw}
            />
            <PreferenceToggle 
              isActive={focusMode}
              onToggle={toggleFocusMode}
              title="Focus Mode"
              description="Automatically collapse other sections when you open a new one."
              icon={Zap}
            />
          </div>
        </section>

        <section className="pt-4 border-t border-zinc-100 flex justify-between items-center">
          <button
            onClick={resetNav}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <RotateCcw size={16} />
            Reset all interface preferences
          </button>
          
          <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">
            Lumina LMS v1.0.4
          </div>
        </section>
      </div>
    </div>
  );
}

function ManagementCard({ href, title, description, icon: Icon }: any) {
  return (
    <Link 
      href={href}
      className="group bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 transition-all flex flex-col justify-between"
    >
      <div>
        <div className="p-2.5 w-fit rounded-xl bg-zinc-50 group-hover:bg-indigo-50 transition-colors">
          <Icon size={20} className="text-zinc-500 group-hover:text-indigo-600" />
        </div>
        <div className="mt-4">
          <h3 className="font-semibold text-zinc-900">{title}</h3>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-6 flex items-center text-sm font-medium text-indigo-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
        Open Module <ArrowRight size={16} className="ml-1" />
      </div>
    </Link>
  );
}

function PreferenceToggle({ isActive, onToggle, title, description, icon: Icon }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm hover:border-indigo-100 transition-colors group">
      <div className="flex items-start justify-between">
        <div className="p-2.5 rounded-xl bg-zinc-50 group-hover:bg-indigo-50 transition-colors">
          <Icon size={20} className="text-zinc-500 group-hover:text-indigo-600" />
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
            isActive ? "bg-indigo-600" : "bg-zinc-200"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
              isActive ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>
      <div className="mt-4">
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
