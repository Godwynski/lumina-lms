"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MicrosoftIcon } from "@/components/ui/microsoft-icon";
import { Logo } from "@/components/layout/Logo";
import { AuthErrorAlert } from "@/components/auth/auth-feedback";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const signInWithCredentials = async (nextEmail: string, nextPassword: string) => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: nextEmail,
        password: nextPassword,
      });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithCredentials(email, password);
  };

  const handleMicrosoftLogin = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: "email profile",
          redirectTo: `${window.location.origin}/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
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
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Sign in</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Access your library workspace.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" title="Recover your password" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-muted"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>

            {error ? <AuthErrorAlert message={error} /> : null}

            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-widest">
              <span className="bg-card px-3 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-lg text-sm font-semibold flex items-center justify-center gap-3 border-input bg-background text-foreground hover:bg-muted hover:text-foreground"
            onClick={handleMicrosoftLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MicrosoftIcon className="h-5 w-5" />
            )}
            <span>{isLoading ? "Redirecting..." : "Sign in with Microsoft"}</span>
          </Button>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Demo Access</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Admin", email: "admin@lumina.test" },
                { label: "Librarian", email: "librarian@lumina.test" },
                { label: "Staff", email: "staff@lumina.test" },
                { label: "Student", email: "student@lumina.test" },
              ].map((role) => (
                <Button
                  key={role.email}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-md border border-dashed border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:border-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-primary transition-all duration-300"
                  onClick={() => signInWithCredentials(role.email, "Password123!")}
                  disabled={isLoading}
                >
                  {role.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border bg-muted/30 py-4 text-sm">
          <span className="text-muted-foreground">Don&apos;t have an account?</span>
          <Link href="/sign-up" className="ml-1.5 font-bold text-foreground hover:text-foreground/80">
            Sign up
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
