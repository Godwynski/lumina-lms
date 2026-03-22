import Link from "next/link";

export const metadata = {
  title: "Sign Up Success | Lumina LMS",
};

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-300 bg-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>

        <h1 className="mb-3 text-3xl font-bold text-slate-900">Check your email</h1>
        <p className="mb-8 leading-relaxed text-slate-600">
          A verification link has been sent to your email address. Please click the link to activate your library account.
        </p>

        <Link
          href="/auth/login"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-8 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Return to sign in
        </Link>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        © 2026 Lumina LMS
      </p>
    </div>
  );
}
