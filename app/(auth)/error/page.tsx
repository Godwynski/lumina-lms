import { Card, CardContent, CardHeader, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, AlertCircle, LogIn } from "lucide-react";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

function getErrorSubtitle(errorCode?: string): string {
  if (!errorCode) return "An unexpected sign-in error occurred.";
  if (errorCode === "archived_account") {
    return "This account is currently archived and cannot sign in.";
  }
  if (errorCode === "restricted_access") {
    return "Access is restricted to STI College Alabang accounts.";
  }
  if (
    errorCode.includes("PKCE") ||
    errorCode.includes("code verifier") ||
    errorCode.includes("refresh_token")
  ) {
    return "Your sign-in session timed out or was interrupted.";
  }
  return "Something interrupted your authentication request.";
}

async function ErrorBody({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const subtitle = getErrorSubtitle(params?.error);

  const isPkceOrSessionError =
    params?.error &&
    (params.error.includes("PKCE") ||
      params.error.includes("code verifier") ||
      params.error.includes("refresh_token"));

  return (
    <>
      <CardHeader className="text-center space-y-2 pb-2 pt-8">
        <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-1">
          <ShieldAlert className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Authentication Error</h1>
        <CardDescription className="text-sm text-muted-foreground">
          {subtitle}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 px-6 sm:px-8">
        {params?.error === "archived_account" ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed font-medium">
                Your account has been <strong>archived</strong>. This typically happens when an account is no longer in use or has been retired.
              </p>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                What this means
              </h2>
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Archived accounts cannot access system resources or borrow books. Your data is preserved for records but active access is disabled.
                </p>
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs font-semibold text-foreground mb-1">Need assistance?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    If you believe this is a mistake, please visit the <strong>School Library Administration</strong> to request account reactivation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : params?.error === "restricted_access" ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed font-medium">
                This system is exclusively for <strong>STI Alabang</strong> students and faculty.
                Please use your official institutional email to sign in.
              </p>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Required email formats
              </h2>
              <div className="space-y-2">
                {[
                  "firstname.lastname@alabang.sti.edu.ph",
                  "lastname.id.@alabang.sti.edu.ph",
                ].map((format) => (
                  <div
                    key={format}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-background flex items-center justify-center border border-border/60">
                      <LogIn className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <code className="text-xs font-medium text-foreground truncate">{format}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : isPkceOrSessionError ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed font-medium">
                Your login session timed out or the verification state was interrupted.
              </p>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Why this happens
              </h2>
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>• The authentication flow took too long to complete, or the verification cookie was blocked.</p>
                <p>• Signing in was started in one tab or app window and completed in another.</p>
                <p className="pt-1 font-medium text-foreground">
                  Please click below to return to the sign-in page and try again.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
            <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60">
              <AlertCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {params?.error ? `Error: ${params.error}` : "An unspecified error occurred"}
              </p>
              <p className="text-xs text-muted-foreground">
                Please contact the system administrator if this persists.
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 pb-8 px-6 sm:px-8 pt-4">
        <Button
          asChild
          variant="outline"
          className="w-full h-11 rounded-lg group font-semibold border-border hover:bg-muted"
        >
          <Link href="/">
            <ArrowLeft className="mr-2 w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Sign In
          </Link>
        </Button>
      </CardFooter>
    </>
  );
}

export const metadata = {
  title: "Authentication Error",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <AuthPageShell>
      <Card className="border-border bg-card shadow-sm overflow-hidden rounded-2xl">
        <Suspense
          fallback={
            <div className="p-8 space-y-4">
              <div className="h-12 w-12 mx-auto rounded-xl bg-muted animate-pulse" />
              <div className="h-6 w-48 mx-auto rounded bg-muted animate-pulse" />
              <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
            </div>
          }
        >
          <ErrorBody searchParams={searchParams} />
        </Suspense>
      </Card>
    </AuthPageShell>
  );
}
