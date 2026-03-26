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
      router.push("/protected");
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
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
      <Card className="overflow-hidden border-slate-200 bg-white text-slate-900 shadow-sm">
        <CardHeader className="space-y-4 pb-5">
          <div className="flex items-center gap-3">
            <Logo size={20} />
            <span className="text-lg font-bold tracking-tight text-slate-900">Lumina LMS</span>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Sign in</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Access your library workspace.
            </CardDescription>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-100 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-md border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-100"
                onClick={() => signInWithCredentials("student@lumina.test", "Password123!")}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                Student Demo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-md border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-100"
                onClick={() => signInWithCredentials("admin@lumina.test", "Password123!")}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
                Admin Demo
              </Button>
            </div>
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
                className="h-11 rounded-lg border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-slate-300"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" title="Recover your password" className="text-xs font-medium text-slate-700 hover:text-slate-900">
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
                  className="h-11 rounded-lg border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-slate-300 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:bg-slate-200"
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
              className="h-11 w-full rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
            >
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-widest">
              <span className="bg-white px-3 text-slate-500">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-lg text-sm font-semibold flex items-center justify-center gap-3 border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900"
            onClick={handleMicrosoftLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
            ) : (
              <MicrosoftIcon className="h-5 w-5" />
            )}
            <span>{isLoading ? "Redirecting..." : "Sign in with Microsoft"}</span>
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-slate-200 bg-slate-50 py-4 text-sm">
          <span className="text-slate-600">Don&apos;t have an account?</span>
          <Link href="/auth/sign-up" className="ml-1.5 font-bold text-slate-900 hover:text-slate-700">
            Sign up
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
