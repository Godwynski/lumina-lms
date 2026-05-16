import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, AlertCircle, LogIn } from "lucide-react";
import { Suspense } from "react";
import { Logo } from "@/components/layout/Logo";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  if (params?.error === "archived_account") {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10 flex gap-3 items-start shadow-inner">
           <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5 opacity-70" />
           <p className="text-xs text-destructive/80 leading-relaxed font-medium">
             Your account has been <strong>archived</strong>. This typically happens when an account is no longer in use or has been retired.
           </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1">
            What this means
          </h4>
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Archived accounts cannot access system resources or borrow books. Your data is preserved for records but active access is disabled.
            </p>
            <div className="pt-2 border-t border-border/50">
               <p className="text-[10px] font-bold text-foreground mb-1 uppercase tracking-tight">Need assistance?</p>
               <p className="text-[11px] text-muted-foreground">
                 If you believe this is a mistake, please visit the <strong>School Library Administration</strong> to request account reactivation.
               </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (params?.error === "restricted_access") {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 items-start shadow-inner">
           <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5 opacity-70" />
           <p className="text-xs text-primary/80 leading-relaxed font-medium">
             This system is exclusively for <strong>STI Alabang</strong> students and faculty. 
             Please use your official institutional email to sign in.
           </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1">
            Required Email Formats
          </h4>
          <div className="space-y-2">
            {[
              "firstname.lastname@alabang.sti.edu.ph",
              "lastname.id.@alabang.sti.edu.ph"
            ].map((format) => (
              <div key={format} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 group transition-all hover:bg-muted">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-background flex items-center justify-center border shadow-sm">
                  <LogIn className="w-4 h-4 text-muted-foreground" />
                </div>
                <code className="text-[11px] font-medium text-foreground truncate">{format}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
      <div className="p-4 rounded-2xl bg-muted/50 border border-border/50">
        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
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
  );
}

export const metadata = {
  title: "Authentication Error | Lumina LMS",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-md w-full space-y-6">
        <div className="flex justify-center mb-8">
          <Logo size={28} className="rotate-3 shadow-2xl" />
        </div>
        
        <Card className="border-border shadow-2xl overflow-hidden rounded-2xl animate-in fade-in zoom-in duration-500">
          <CardHeader className="text-center space-y-2 pb-2 pt-8">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="w-7 h-7 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Authentication Error</CardTitle>
            <CardDescription className="text-sm font-medium">
              Access to the system was restricted
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4 px-8">
            <Suspense fallback={<div className="h-40 w-full animate-pulse bg-muted rounded-xl" />}>
              <ErrorContent searchParams={searchParams} />
            </Suspense>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pb-8 px-8 pt-4">
             <Button asChild variant="outline" className="w-full h-11 rounded-xl group font-semibold shadow-sm transition-all hover:bg-muted border-border/50">
                <Link href="/">
                  <ArrowLeft className="mr-2 w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  Back to Sign In
                </Link>
             </Button>
          </CardFooter>
        </Card>
        
        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-50">
          Lumina LMS Security Protocol
        </p>
      </div>
    </div>
  );
}
