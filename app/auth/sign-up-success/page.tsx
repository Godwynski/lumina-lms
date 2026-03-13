import Link from "next/link";

export const metadata = {
  title: "Sign Up Success | Lumina LMS",
};

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="h-16 w-16 mb-8 rounded-2xl bg-white shadow-xl shadow-indigo-500/10 border border-indigo-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-zinc-900 mb-4">Check your email</h1>
        
        <p className="text-zinc-600 leading-relaxed mb-10 max-w-sm">
          A verification link has been sent to your email address. Please click the link to activate your library account.
        </p>

        <Link
          href="/auth/login"
          className="h-11 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm"
        >
          Return to sign in
        </Link>
      </div>

      <p className="absolute bottom-6 text-xs text-zinc-500">
        © 2026 Lumina LMS. All rights reserved.
      </p>
    </div>
  );
}
