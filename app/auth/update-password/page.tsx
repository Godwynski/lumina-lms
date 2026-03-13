import { UpdatePasswordForm } from "@/components/update-password-form";

import { Suspense } from "react";

export const metadata = {
  title: "Update Password | Lumina LMS",
};

export default function UpdatePasswordPage() {
  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-900 flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-10 overflow-hidden bg-white border-r border-zinc-200">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
          </svg>
          <span className="font-bold text-base tracking-tight text-zinc-900">Lumina LMS</span>
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="text-4xl font-black leading-tight bg-clip-text text-transparent bg-gradient-to-br from-zinc-900 to-zinc-500">
            Set your new<br />password.
          </div>
          <p className="text-zinc-600 text-sm leading-relaxed max-w-xs">
            Choose a strong password to protect your library account and reading history.
          </p>
        </div>

        <p className="relative z-10 text-xs text-zinc-500">
          © 2026 Lumina LMS. All rights reserved.
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent pointer-events-none" />



        <div className="w-full max-w-sm relative z-10">
          <Suspense fallback={<div className="h-96 w-full animate-pulse bg-zinc-100 rounded-3xl" />}>
            <UpdatePasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
