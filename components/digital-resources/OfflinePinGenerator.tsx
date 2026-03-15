"use client";

import { useState } from "react";
import { Key, ShieldAlert, RefreshCw, Terminal, Clock, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OfflinePinGenerator() {
  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const generatePin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/offline/generate-pin", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setPin(data.pin);
        setExpiresAt(new Date(data.expiresAt).toLocaleTimeString());
      } else {
        setError(data.error || "Failed to generate PIN");
      }
    } catch (err) {
      setError("Network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const revokeAll = async () => {
    if (!confirm("Are you sure you want to revoke all active offline sessions? This will instantly terminate access on all devices.")) return;
    
    setLoading(true);
    try {
      const response = await fetch("/api/offline/revoke", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        setPin(null);
        alert("All offline sessions revoked.");
      }
    } catch (err) {
      alert("Failed to revoke sessions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden text-white relative">
      <div className="p-8 border-b border-zinc-800 bg-zinc-900/50 relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
            <ShieldAlert size={20} />
          </div>
          <h3 className="text-xl font-bold tracking-tight">Blackout Contingency</h3>
        </div>
        <p className="text-zinc-400 text-sm">Generate emergency offline access PINs for students when internet is down.</p>
      </div>

      <div className="p-8 space-y-8 relative z-10">
        {pin ? (
          <div className="space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center justify-center p-8 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 border border-indigo-500">
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-2">Active Emergency PIN</span>
              <div className="text-6xl font-black tracking-[0.2em] mb-4 font-mono">{pin}</div>
              <div className="flex items-center gap-2 text-indigo-200 text-xs bg-indigo-700/50 px-3 py-1.5 rounded-full">
                <Clock size={14} />
                <span>Expires at {expiresAt}</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 flex items-start gap-4">
               <div className="p-2 bg-zinc-700 rounded-xl text-zinc-400">
                  <Terminal size={18} />
               </div>
               <div className="text-sm">
                  <p className="text-zinc-200 font-medium mb-1">How to use:</p>
                  <p className="text-zinc-400 leading-relaxed">
                    Instruct students to go to <code className="text-indigo-400">/offline-access</code> on the school intranet and enter this PIN.
                  </p>
               </div>
            </div>
            
            <Button 
               onClick={generatePin} 
               variant="outline" 
               className="w-full h-12 rounded-xl border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
            >
              <RefreshCw size={18} className="mr-2" />
              Generate New PIN
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 mb-6">
              <Key size={32} />
            </div>
            <Button 
               onClick={generatePin} 
               disabled={loading}
               className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-14 px-8 font-bold shadow-xl shadow-indigo-500/20 min-w-[200px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                "Issue Emergency PIN"
              )}
            </Button>
          </div>
        )}

        <div className="pt-8 border-t border-zinc-800">
          <Button 
            onClick={revokeAll} 
            variant="ghost" 
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl h-12"
          >
            <ShieldAlert size={18} className="mr-2" />
            Revoke All Active Sessions
          </Button>
        </div>
      </div>

      {/* Decorative background circle */}
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
    </div>
  );
}
