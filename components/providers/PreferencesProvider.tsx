"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Preferences = Record<string, any>;

interface PreferencesContextType {
  preferences: Preferences;
  loading: boolean;
  updatePreferences: (newPrefs: Preferences) => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch("/api/ui-preferences");
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || {});
      }
    } catch (error) {
      console.error("Failed to fetch UI preferences:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

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
