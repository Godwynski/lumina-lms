"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MicrosoftIcon } from "@/components/ui/microsoft-icon";
import { AuthErrorAlert } from "@/components/auth/auth-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { resolveStudentId } from "@/lib/library-card-assets";
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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const studentIdPreview = resolveStudentId({ email });

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
        <CardHeader className="space-y-1.5 pb-6">
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Sign in</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Access your library workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <AuthErrorAlert message={error} /> : null}

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              signInWithCredentials(email, password);
            }} 
            className="space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email">Email address</Label>
                {studentIdPreview && (
                  <span className="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                    ID: {studentIdPreview}
                  </span>
                )}
              </div>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-input bg-background px-4 text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link 
                  href="/forgot-password" 
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
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
                  className="h-12 rounded-xl border-input bg-background px-4 text-sm focus-visible:ring-2 focus-visible:ring-primary/20 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-xl text-sm font-bold bg-[#1e293b] text-white hover:bg-[#0f172a] shadow-md transition-all active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-card px-4 text-muted-foreground/60">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-3 border-input bg-background text-foreground hover:bg-muted shadow-sm transition-all"
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

          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                <span className="bg-card px-4 text-muted-foreground/60">Demo Access</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Admin", email: "admin@lumina.test" },
                { label: "Librarian", email: "librarian@lumina.test" },
                { label: "Staff", email: "staff@lumina.test" },
                { label: "Student", email: "student@lumina.test" },
              ].map((role) => (
                <Button
                  key={role.email}
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-dashed border-border text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary transition-all duration-300"
                  onClick={() => signInWithCredentials(role.email, "Password123!")}
                  disabled={isLoading}
                >
                  {role.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border bg-muted/30 py-6">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-bold text-foreground hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
