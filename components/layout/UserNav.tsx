"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface UserNavProps {
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
  profile: any;
  role: string | null;
}

export function UserNav({ user, profile, role }: UserNavProps) {
  const router = useRouter();
  const supabase = createClient();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    setLogoutDialogOpen(false);
    router.refresh();
    router.push("/auth/login");
  };

  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-xl transition-all hover:scale-[1.02] hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 data-[state=open]:bg-slate-100"
          >
          <Avatar className="h-10 w-10 rounded-xl border border-slate-300">
            <AvatarImage src={avatarUrl} alt={name} />
            <AvatarFallback className="bg-slate-100 font-bold text-slate-700">
              {initials}
            </AvatarFallback>
          </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium leading-none">{name}</p>
                {role && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    {role}
                  </span>
                )}
              </div>
              <p className="text-xs leading-tight text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/protected/settings" className="flex w-full cursor-pointer items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer font-semibold text-red-600 focus:text-red-600"
            onSelect={(event) => {
              event.preventDefault();
              setLogoutDialogOpen(true);
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="max-w-sm rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">Log out?</DialogTitle>
            <DialogDescription>
              You will be signed out of your current session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg" onClick={() => setLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-9 rounded-lg"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out..." : "Log out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
