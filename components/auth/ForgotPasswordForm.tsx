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
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={cn("mx-auto w-full max-w-md", className)} {...props}>
        <Card className="overflow-hidden border-border bg-card text-foreground shadow-sm">
          <CardHeader className="space-y-4 pb-5">
            <div className="flex items-center gap-3">
              <Logo size={20} />
              <span className="text-lg font-bold tracking-tight text-foreground">Lumina LMS</span>
            </div>
            <div className="flex flex-col items-center justify-center pt-4 pb-2">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/50">
                <MailCheck className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Check your email</CardTitle>
              <CardDescription className="mt-2 text-center text-muted-foreground">
                We&apos;ve sent a password reset link to <span className="font-semibold text-foreground">{email}</span>.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-8">
            <Button asChild variant="outline" className="h-11 w-full rounded-lg border-input hover:bg-muted">
              <Link href="/auth/login">
                Return to sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-md", className)} {...props}>
      <Card className="overflow-hidden border-border bg-card text-foreground shadow-sm">
        <CardHeader className="space-y-4 pb-5">
          <div className="flex items-center gap-3">
            <Logo size={20} />
            <span className="text-lg font-bold tracking-tight text-foreground">Lumina LMS</span>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Reset password</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Enter your email to receive a password reset link.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring"
              />
            </div>

            {error ? <AuthErrorAlert message={error} /> : null}

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-11 w-full rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {isLoading ? "Sending link..." : "Send reset link"}
            </Button>
          </form>

          <Link
            href="/auth/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
