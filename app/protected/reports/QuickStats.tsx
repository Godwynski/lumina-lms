import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Activity, BookCheck, ClipboardList, TrendingUp } from "lucide-react";

export async function QuickStats() {
  const supabase = await createClient();
  const now = new Date();

  const [activeLoans, overdueLoans, pendingCards, suspendedCards] = await Promise.all([
    supabase.from("borrowing_records").select("id", { count: "exact", head: true }).in("status", ["active", "ACTIVE"]),
    supabase.from("borrowing_records").select("id", { count: "exact", head: true }).in("status", ["active", "ACTIVE"]).lt("due_date", now.toISOString()),
    supabase.from("library_cards").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("library_cards").select("id", { count: "exact", head: true }).eq("status", "suspended"),
  ]);

  const stats = [
    { label: "Active Loans", value: activeLoans.count ?? 0, icon: ClipboardList, color: "bg-indigo-500/10 text-indigo-500", href: "/protected/history" },
    { label: "Overdue", value: overdueLoans.count ?? 0, icon: Activity, color: "bg-rose-500/10 text-rose-500", href: "/protected/history" },
    { label: "Circulation", value: "Live", icon: TrendingUp, color: "bg-emerald-500/10 text-emerald-500", href: "/protected/history" },
    { label: "Pending", value: pendingCards.count ?? 0, icon: BookCheck, color: "bg-amber-500/10 text-amber-500", href: "/protected/admin/approvals" },
    { label: "Suspended", value: suspendedCards.count ?? 0, icon: Activity, color: "bg-muted text-muted-foreground", href: "/protected/admin/approvals" },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
      {stats.map((stat, idx) => (
        <Link 
          key={idx} 
          href={stat.href} 
          className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all hover:border-border hover:shadow-md active:scale-95"
        >
          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
            <stat.icon className="h-5 w-5" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-2xl font-black text-foreground">{stat.value}</p>
        </Link>
      ))}
    </div>
  );
}

export function QuickStatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[120px] rounded-2xl border border-border/60 bg-muted/20 p-4" />
      ))}
    </div>
  );
}
