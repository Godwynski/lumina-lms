"use client";

import { useState, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Section, PremiumToggle } from "../SettingsShared";
import { SettingsShell } from "../SettingsShell";

interface PreferencesSectionProps {
  role: string;
}

export function PreferencesSection({ role }: PreferencesSectionProps) {
  const { preferences, updatePreferences: updatePrefsContext } = usePreferences();
  
  const [intelligentAlerts, setIntelligentAlerts] = useState(true);
  const [initialAlerts, setInitialAlerts] = useState(true);

  useEffect(() => {
    if (preferences && typeof preferences.intelligentAlerts === "boolean") {
      setIntelligentAlerts(preferences.intelligentAlerts);
      setInitialAlerts(preferences.intelligentAlerts);
    }
  }, [preferences]);

  const isDirty = intelligentAlerts !== initialAlerts;

  const savePreferences = async () => {
    try {
      await updatePrefsContext({ intelligentAlerts });
      setInitialAlerts(intelligentAlerts);
      toast.success("Preferences updated");
    } catch {
      toast.error("Failed to save preferences");
    }
  };

  const clearLocalPreferences = async () => {
    const defaultAlerts = true;
    setIntelligentAlerts(defaultAlerts);
    await updatePrefsContext({
      intelligentAlerts: defaultAlerts,
    });
    setInitialAlerts(defaultAlerts);
    toast.success("Settings reset to defaults");
  };

  return (
    <SettingsShell 
      title="Preferences" 
      description="Notification and display settings" 
      role={role}
      isDirty={isDirty}
    >
      <Section title="Library Experience" icon={SlidersHorizontal} hideHeaderOnMobile>
        <div className="space-y-3">
          <PremiumToggle 
            title="Intelligent Alerts" 
            description="Receive smart notifications for due dates and library updates."
            checked={intelligentAlerts}
            onChange={setIntelligentAlerts}
          />
        </div>
        <div className="flex items-center gap-3 pt-4">
          <Button 
            variant="default" 
            onClick={savePreferences} 
            disabled={!isDirty}
            className={cn("h-10 flex-1 rounded-lg sm:flex-none sm:px-8 font-bold shadow-md", !isDirty && "opacity-50")}
          >
            Save Preferences
          </Button>
          <Button variant="outline" onClick={clearLocalPreferences} className="h-10 rounded-lg border-border text-muted-foreground font-bold px-6">
            Reset Defaults
          </Button>
        </div>
      </Section>
    </SettingsShell>
  );
}
