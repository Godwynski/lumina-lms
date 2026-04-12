import Link from "next/link";

export const metadata = {
  title: "Sign Up Success | Lumina LMS",
};

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>

        <h1 className="mb-3 text-3xl font-bold text-foreground">Check your email</h1>
        <p className="mb-8 leading-relaxed text-muted-foreground">
          A verification link has been sent to your email address. Please click the link to activate your library account.
        </p>

        <Link
          href="/auth/login"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Return to sign in
        </Link>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        © 2026 Lumina LMS
      </p>
    </div>
  );
}
