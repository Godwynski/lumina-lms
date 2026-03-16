"use client";

import { useState } from "react";
import { KeyRound, ShieldAlert, ChevronRight, Loader2, Info, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";

export default function OfflineAccessPage() {
  const [pin, setPin] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentId.trim()) {
      setError("Please enter your Student ID number.");
      return;
    }
    if (pin.length !== 6) {
      setError("Please enter a 6-digit PIN.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/offline/validate", {
        method: "POST",
        body: JSON.stringify({ pin, student_id: studentId.trim() }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success) {
        router.push(data.redirect);
      } else {
        setError(data.error || "Validation failed");
      }
    } catch (_err) {
      setError("Network error. Make sure you are connected to the school server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl mb-4 group hover:border-indigo-500/50 transition-colors">
            <KeyRound className="text-indigo-400 group-hover:scale-110 transition-transform" size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Emergency Access</h1>
          <p className="text-zinc-500">
            Present your ID to the librarian then enter the 6-digit PIN they provide.
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl p-8 rounded-3xl border border-zinc-800 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400 rounded-2xl">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Student ID Field */}
            <div className="space-y-2">
              <Label htmlFor="student-id" className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                Student ID Number
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <Input
                  id="student-id"
                  type="text"
                  placeholder="e.g. 2024-00001"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="pl-11 bg-zinc-950 border-zinc-800 text-white h-14 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  disabled={loading}
                  autoFocus
                  autoComplete="off"
                />
              </div>
            </div>

            {/* PIN Field */}
            <div className="space-y-2">
              <Label htmlFor="pin-input" className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                6-Digit Offline PIN
              </Label>
              <Input
                id="pin-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="bg-zinc-950 border-zinc-800 text-white text-center text-4xl font-black tracking-[0.5em] h-20 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-zinc-800"
                disabled={loading}
                autoComplete="off"
              />
              <p className="text-center text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
                Enter 6-digit code
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || pin.length !== 6 || !studentId.trim()}
              className="w-full h-14 bg-white text-black hover:bg-zinc-200 rounded-2xl font-bold text-lg shadow-xl shadow-white/5 transition-all group"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  Connect Locally
                  <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="p-4 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 flex items-start gap-3">
          <Info className="text-zinc-500 shrink-0 mt-0.5" size={16} />
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            <span className="text-zinc-400 font-bold uppercase tracking-tight mr-1">Network Fence:</span>
            Offline sessions are temporary (max 2 hours) and strictly limited to the Digital Resources module. Other features like borrowing or profile management require a standard login.
          </p>
        </div>
      </div>
    </div>
  );
}
