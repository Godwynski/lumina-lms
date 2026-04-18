"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { isAbortError } from "@/lib/error-utils";

type Preferences = Record<string, unknown>;

interface PreferencesContextType {
  preferences: Preferences;
  loading: boolean;
  updatePreferences: (newPrefs: Preferences) => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ 
  children,
  initialPreferences = {}
}: { 
  children: React.ReactNode;
  initialPreferences?: Preferences | Promise<Preferences>;
}) {
  const isPromise = initialPreferences && typeof (initialPreferences as Record<string, unknown>).then === 'function';

  const [preferences, setPreferences] = useState<Preferences>(
    isPromise ? {} : (initialPreferences as Preferences)
  );
  const [loading, setLoading] = useState(
    isPromise || 
    !initialPreferences || 
    Object.keys(initialPreferences as Preferences).length === 0
  );

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
    // If we have a promise-like object, resolve it and update state.
    if (initialPreferences && typeof (initialPreferences as Record<string, unknown>).then === 'function') {
      const promise = Promise.resolve(initialPreferences as Preferences | Promise<Preferences>);
      promise.then((resolved) => {
        if (resolved && Object.keys(resolved as Preferences).length > 0) {
          setPreferences(resolved as Preferences);
          setLoading(false);
        } else {
          fetchPreferences();
        }
      }).catch((err) => {
        console.error("[PREFERENCES-PROVIDER] Promise hydration failed:", err);
        fetchPreferences();
      });
      return;
    }

    // If we have initial preferences from the server, we don't need to fetch on mount.
    if (initialPreferences && Object.keys(initialPreferences as Preferences).length > 0) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchPreferences(controller.signal);
    return () => controller.abort();
  }, [fetchPreferences, initialPreferences]);

  const updatePreferences = async (newPrefs: Preferences) => {
    // Optimistic update
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
      // Revert if failed
      fetchPreferences();
    }
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        loading,
        updatePreferences,
        refreshPreferences: fetchPreferences,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
