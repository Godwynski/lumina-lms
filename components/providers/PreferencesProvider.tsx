"use client";

import React, { createContext, useEffect, useState, useCallback, useRef, useContext } from "react";
import { isAbortError } from "@/lib/error-utils";
import { createClient } from "@/lib/supabase/client";
import { type User } from "@supabase/supabase-js";
import { type UserRole, type ProfileData } from "@/lib/types";

type Preferences = Record<string, unknown>;

interface PreferencesContextType {
  preferences: Preferences;
  loading: boolean;
  updatePreferences: (newPrefs: Preferences) => Promise<void>;
  refreshPreferences: () => Promise<void>;
  role: UserRole | null;
  profile: (ProfileData & { role?: string; status?: string }) | null;
  currentMode: "staff" | "student";
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ 
  children,
  initialPreferences = {},
  initialRole = null,
  initialProfile = null,
  user = null,
}: { 
  children: React.ReactNode;
  initialPreferences?: Preferences | Promise<Preferences>;
  initialRole?: UserRole | null;
  initialProfile?: (ProfileData & { role?: string; status?: string }) | null;
  user?: User | null;
}) {
  const isPromise = initialPreferences instanceof Promise;
  const resolvedRef = useRef(false);
  const [supabase] = useState(() => createClient());

  const [preferences, setPreferences] = useState<Preferences>(
    isPromise ? {} : (initialPreferences as Preferences)
  );
  const [loading, setLoading] = useState(
    isPromise || 
    !initialPreferences || 
    Object.keys(initialPreferences as Preferences).length === 0
  );

  // Unified role and profile states, listening in real-time
  const [role, setRole] = useState<UserRole | null>(initialRole);
  const [profile, setProfile] = useState<(ProfileData & { role?: string; status?: string }) | null>(initialProfile);

  // Sync initial state if props change on mount
  useEffect(() => {
    setRole(initialRole);
    setProfile(initialProfile);
  }, [initialRole, initialProfile]);

  const fetchPreferences = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/ui-preferences", { signal });
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || {});
      }
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      console.error("Failed to fetch UI preferences:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (resolvedRef.current) return;

    const isThenable = initialPreferences && 
      (initialPreferences instanceof Promise || typeof (initialPreferences as Record<string, unknown>).then === 'function');

    if (isThenable) {
      resolvedRef.current = true;
      Promise.resolve(initialPreferences as Promise<Preferences>)
        .then((resolved) => {
          if (resolved && Object.keys(resolved).length > 0) {
            setPreferences(resolved);
            setLoading(false);
          } else {
            fetchPreferences();
          }
        })
        .catch((err) => {
          console.error("[PREFERENCES-PROVIDER] Promise hydration failed:", err);
          fetchPreferences();
        });
      return;
    }

    if (initialPreferences && Object.keys(initialPreferences as Preferences).length > 0) {
      resolvedRef.current = true;
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    resolvedRef.current = true;
    fetchPreferences(controller.signal);
    return () => controller.abort();
  }, [fetchPreferences, initialPreferences]);

  // Real-time subscription for profile and preference updates
  useEffect(() => {
    if (!user?.id) return;

    const profileChannel = supabase
      .channel(`app-profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newProfile = payload.new as ProfileData & { role?: string; status?: string };
          setProfile(newProfile);
          if (newProfile.role) {
            setRole(newProfile.role.toLowerCase() as UserRole);
          }
        }
      )
      .subscribe();

    const prefsChannel = supabase
      .channel(`app-prefs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ui_preferences",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const nextPrefs = (payload.new as { preferences?: Record<string, unknown> })?.preferences || {};
          setPreferences(nextPrefs);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileChannel);
      void supabase.removeChannel(prefsChannel);
    };
  }, [user?.id, supabase]);

  const updatePreferences = async (newPrefs: Preferences) => {
    setPreferences(prev => ({ ...prev, ...newPrefs }));

    try {
      const response = await fetch("/api/ui-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });

      if (!response.ok) {
        throw new Error("Failed to update preferences");
      }

      const data = await response.json();
      setPreferences(data.preferences || {});
    } catch (error) {
      console.error("Error updating preferences:", error);
      fetchPreferences();
    }
  };

  // Centrally calculated view mode (staff or student)
  const isDeactivatedSA = role === "student_assistant" && profile?.status?.toUpperCase() !== "ACTIVE";
  const hasAnyPermission = role === "student_assistant"
    ? !!(profile?.permissions?.manage_circulation || profile?.permissions?.manage_attendance || profile?.permissions?.view_admin_dashboard)
    : true;

  const currentMode: "staff" | "student" = (isDeactivatedSA || (role === "student_assistant" && !hasAnyPermission))
    ? "student" 
    : (role === "super_admin" || role === "librarian" || role === "student_assistant")
      ? "staff"
      : "student";

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        loading,
        updatePreferences,
        refreshPreferences: fetchPreferences,
        role,
        profile,
        currentMode,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

const fallbackContext: PreferencesContextType = {
  preferences: {},
  loading: false,
  updatePreferences: async () => {},
  refreshPreferences: async () => {},
  role: null,
  profile: null,
  currentMode: "student",
};

export function usePreferences() {
  const context = useContext(PreferencesContext);
  return context ?? fallbackContext;
}


