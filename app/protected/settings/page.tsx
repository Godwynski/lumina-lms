"use client";

import { useEffect, useState } from "react";

type Role = "admin" | "librarian" | "staff" | "student";

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [compactTables, setCompactTables] = useState(false);
  const [role] = useState<Role>("admin");

  useEffect(() => {
    setMounted(true);
    setDisplayName(localStorage.getItem("lumina_profile_name") || "");
    setEmailAlerts(localStorage.getItem("lumina_email_alerts") !== "false");
    setRememberDevice(localStorage.getItem("lumina_remember_device") !== "false");
    setCompactTables(localStorage.getItem("lumina_compact_tables") === "true");
  }, []);

  const saveProfile = () => {
    localStorage.setItem("lumina_profile_name", displayName.trim());
    alert("Profile settings saved.");
  };

  const savePreferences = () => {
    localStorage.setItem("lumina_email_alerts", String(emailAlerts));
    localStorage.setItem("lumina_remember_device", String(rememberDevice));
    localStorage.setItem("lumina_compact_tables", String(compactTables));
    alert("Preferences updated.");
  };

  const clearLocalPreferences = () => {
    localStorage.removeItem("lumina_profile_name");
    localStorage.removeItem("lumina_email_alerts");
    localStorage.removeItem("lumina_remember_device");
    localStorage.removeItem("lumina_compact_tables");
    setDisplayName("");
    setEmailAlerts(true);
    setRememberDevice(true);
    setCompactTables(false);
    alert("Local settings reset.");
  };

  if (!mounted) return null;

  const canManageSystem = role === "admin" || role === "librarian";

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Settings</h1>
        <p className="text-zinc-500">Manage your account, preferences, and security.</p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Profile</h2>
        <div className="grid gap-2">
          <label htmlFor="display-name" className="text-sm font-medium text-zinc-700">
            Display name
          </label>
          <input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your display name"
            className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={saveProfile}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Save profile
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Preferences</h2>
        <ToggleRow
          title="Email alerts"
          description="Receive due date, renewal, and approval notifications."
          checked={emailAlerts}
          onChange={setEmailAlerts}
        />
        <ToggleRow
          title="Remember this device"
          description="Keep your device trusted for faster sign-in."
          checked={rememberDevice}
          onChange={setRememberDevice}
        />
        <ToggleRow
          title="Compact tables"
          description="Use denser table rows in dashboard and reports."
          checked={compactTables}
          onChange={setCompactTables}
        />
        <button
          onClick={savePreferences}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Save preferences
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Security</h2>
        <p className="text-sm text-zinc-600">For password and session controls, use the account security page.</p>
        <a
          href="/auth/update-password"
          className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Go to password settings
        </a>
      </section>

      {canManageSystem && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold text-amber-900">Admin controls</h2>
          <p className="text-sm text-amber-800">
            You can clear local settings used by this browser for testing and support.
          </p>
          <button
            onClick={clearLocalPreferences}
            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            Reset local settings
          </button>
        </section>
      )}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
      <div>
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-zinc-300"
        }`}
        aria-pressed={checked}
        type="button"
      >
        <span
          className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
