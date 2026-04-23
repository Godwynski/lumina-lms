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
import { Logo } from "@/components/layout/Logo";
import { MicrosoftIcon } from "@/components/ui/microsoft-icon";
import { AuthErrorAlert } from "@/components/auth/auth-feedback";
import { resolveStudentId } from "@/lib/library-card-assets";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const studentIdPreview = resolveStudentId({ email });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (fullName.trim().length < 2) {
      setError("Please enter your full name");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
          }
        }
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
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
          redirectTo: `${window.location.origin}/auth/callback`,
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
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Create account</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Join Lumina to access your digital library resources.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 rounded-lg border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email">Email address</Label>
                {studentIdPreview && (
                  <span className="text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-full animate-in fade-in slide-in-from-right-1">
                    Your ID: {studentIdPreview}
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
                className="h-11 rounded-lg border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 rounded-lg border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>

            {error ? <AuthErrorAlert message={error} /> : null}

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-11 w-full rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {isLoading ? "Creating account..." : "Create account"}
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
            <span>{isLoading ? "Redirecting..." : "Sign up with Microsoft"}</span>
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border bg-muted/30 py-4 text-sm">
          <span className="text-muted-foreground">Already have an account?</span>
          <Link href="/login" className="ml-1.5 font-bold text-foreground hover:text-foreground/80">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
