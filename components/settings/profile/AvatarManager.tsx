"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarManagerProps {
  initialAvatarUrl: string | null;
  fullName: string | null;
}

export function AvatarManager({ initialAvatarUrl, fullName }: AvatarManagerProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-card/30 p-5 w-full sm:w-56 shadow-sm transition-all hover:bg-card/50">
      <Avatar className="h-28 w-28 rounded-2xl border-4 border-background shadow-md">
        <AvatarImage src={initialAvatarUrl || undefined} alt={fullName || "Profile"} className="object-cover" />
        <AvatarFallback className="rounded-2xl bg-muted text-xl font-bold">
          {(fullName || "U").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="text-center mt-2">
        <p className="text-xs font-black uppercase tracking-widest text-foreground/80">Profile Photo</p>
        <p className="text-[10px] text-muted-foreground/70 font-medium">Official Identity</p>
      </div>
    </div>
  );
}
