"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { AuthErrorAlert } from "@/components/auth/auth-feedback";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("mx-auto w-full max-w-md", className)} {...props}>
      <Card className="overflow-hidden border-border bg-card text-foreground shadow-sm">
        <CardHeader className="space-y-4 pb-5">
          <Link href="/" className="flex items-center gap-3 w-fit hover:opacity-80 transition-opacity md:hidden">
            <Logo size={20} />
            <span className="text-lg font-bold tracking-tight text-foreground">Lumina LMS</span>
          </Link>
          
          {success ? (
            <div className="flex flex-col items-center justify-center pt-4 pb-2 animate-in zoom-in duration-300">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <MailCheck className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Check your email</CardTitle>
              <CardDescription className="mt-2 text-center text-muted-foreground leading-relaxed">
                We&apos;ve sent a password reset link to <br/>
                <span className="font-bold text-foreground">{email}</span>.
              </CardDescription>
            </div>
          ) : (
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Reset password</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Enter your email to receive a password reset link.
              </CardDescription>
            </div>
          )}
        </CardHeader>
        
        <CardContent className={cn(success ? "pb-8" : "")}>
          {success ? (
            <Button asChild variant="outline" className="h-11 w-full rounded-xl border-input hover:bg-muted font-semibold shadow-sm transition-all">
              <Link href="/">
                Return to sign in
              </Link>
            </Button>
          ) : (
            <>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl border-input bg-background px-3.5 text-sm transition-all focus-visible:ring-primary/20"
                  />
                </div>

                {error && <AuthErrorAlert message={error} />}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 h-11 w-full rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Sending link...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>

              <Link
                href="/"
                className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
