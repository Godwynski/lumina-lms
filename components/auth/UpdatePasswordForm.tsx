"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setFormError("");
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("mx-auto w-full max-w-md", className)} {...props}>
      <Card className="overflow-hidden border-border bg-card text-foreground shadow-sm rounded-2xl">
        <CardHeader className="space-y-4 pb-5">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">Set a new password for your account.</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Enter a secure password to complete the reset process.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form aria-busy={isLoading} onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  aria-describedby="password-rules"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring pr-10"
                />
                <Button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
              <p id="password-rules" className="text-xs text-muted-foreground leading-relaxed">
                Password rules: at least 6 characters, combining letters, numbers, and symbols.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Updating..." : "Update password"}
            </Button>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          </form>

          <Link
            href="/"
            className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
