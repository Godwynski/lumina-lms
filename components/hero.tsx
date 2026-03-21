import type { User } from '@supabase/supabase-js';

export function Hero({ user, role }: { user: User | null; role: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
          </svg>
        </div>
        <span className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Lumina LMS</span>
      </div>

      <div className="space-y-4">
        {user ? (
          <>
            <p className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Account Active</p>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
              Welcome back, {user.user_metadata?.full_name || user.email?.split('@')[0]}.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
              You are signed in with the {role} role and have access to your workspace.
            </p>
          </>
        ) : (
          <>
            <p className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Library Operations Platform</p>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
              Structured, reliable library management for every role.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
              Lumina centralizes catalog operations, circulation, and digital resources in one clean operational interface.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
