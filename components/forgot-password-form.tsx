"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={cn("w-full", className)} {...props}>
        {/* Logo mark */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-900">Lumina LMS</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Check your email</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            We&apos;ve sent a password reset link to <span className="text-indigo-600 font-medium">{email}</span>. Click the link to reset your password.
          </p>
        </div>

        <Link
          href="/auth/login"
          className="h-11 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-900 font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-1 w-full"
        >
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} {...props}>
      {/* Logo mark */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
          </svg>
        </div>
        <span className="font-bold text-lg tracking-tight text-zinc-900">Lumina LMS</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Reset password</h1>
        <p className="text-zinc-500 text-sm">Enter your email to receive a reset link</p>
      </div>

      <form onSubmit={handleForgotPassword} autoComplete="on" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-zinc-700 text-sm font-medium">
            Email address
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-indigo-500/20 h-11 rounded-xl"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-1 w-full"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Sending link…
            </>
          ) : "Send reset link"}
        </button>
      </form>

      <div className="mt-6 flex justify-center">
        <Link
          href="/auth/login"
          className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          &larr; Back to sign in
        </Link>
      </div>
    </div>
  );
}
