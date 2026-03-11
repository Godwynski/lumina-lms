import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { Suspense } from "react";
import Link from "next/link";
import {
  Library,
  Users,
  BookMarked,
  BarChart2,
  ShieldCheck,
  Settings,
  History,
  CreditCard,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";

type Role = "admin" | "librarian" | "staff" | "student" | null;

interface QuickCard {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  roles: Role[];
}

const QUICK_CARDS: QuickCard[] = [
  {
    href: "/protected/catalog",
    label: "Catalog & Inventory",
    description: "Manage books, categories, borrowing, and renewals.",
    icon: Library,
    color: "indigo",
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/users",
    label: "Users & Roles",
    description: "Manage admins, librarians, students, and e-library card approvals.",
    icon: Users,
    color: "violet",
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/fines",
    label: "Fines",
    description: "View, pay, and waive borrower fines.",
    icon: BookMarked,
    color: "rose",
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/reports",
    label: "Reports & Analytics",
    description: "View system-wide usage reports and analytics.",
    icon: BarChart2,
    color: "emerald",
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/history",
    label: "My History",
    description: "View your borrowing history and self-service renewals.",
    icon: History,
    color: "sky",
    roles: ["admin", "librarian", "staff", "student"],
  },
  {
    href: "/protected/my-card",
    label: "E-Library Card",
    description: "View and manage your digital library card.",
    icon: CreditCard,
    color: "amber",
    roles: ["admin", "librarian", "staff", "student"],
  },
  {
    href: "/protected/resources",
    label: "Digital Resources",
    description: "Access e-books, journals, and digital materials.",
    icon: BookOpen,
    color: "teal",
    roles: ["admin", "librarian", "staff", "student"],
  },
  {
    href: "/protected/settings",
    label: "Settings",
    description: "Configure system-wide settings and preferences.",
    icon: Settings,
    color: "zinc",
    roles: ["admin"],
  },
  {
    href: "/protected/audit",
    label: "Audit Logs",
    description: "Review system activity and audit trails.",
    icon: ShieldCheck,
    color: "orange",
    roles: ["admin"],
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",     color: "text-amber-700 bg-amber-100 border-amber-200" },
  librarian: { label: "Librarian", color: "text-indigo-700 bg-indigo-100 border-indigo-200" },
  staff:     { label: "Staff",     color: "text-sky-700 bg-sky-100 border-sky-200" },
  student:   { label: "Student",   color: "text-emerald-700 bg-emerald-100 border-emerald-200" },
};

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-indigo-100",
  violet: "bg-violet-50 text-violet-600 border-violet-100 group-hover:bg-violet-100",
  rose:   "bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-100",
  emerald:"bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-100",
  sky:    "bg-sky-50 text-sky-600 border-sky-100 group-hover:bg-sky-100",
  amber:  "bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-100",
  teal:   "bg-teal-50 text-teal-600 border-teal-100 group-hover:bg-teal-100",
  zinc:   "bg-zinc-100 text-zinc-600 border-zinc-200 group-hover:bg-zinc-200",
  orange: "bg-orange-50 text-orange-600 border-orange-100 group-hover:bg-orange-100",
};

import BlurFade from "@/components/magicui/blur-fade";
import { MagicCard } from "@/components/magicui/magic-card";

async function DashboardContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = (await getUserRole()) as Role;

  const roleInfo = role ? ROLE_LABELS[role] : null;
  const visibleCards = QUICK_CARDS.filter(
    (card) => !role || card.roles.includes(role)
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <LayoutDashboard size={22} className="text-zinc-400" />
            <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
            {roleInfo && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-zinc-600 text-sm">Welcome back!</p>
            {user?.email && (
              <p className="text-zinc-500 text-xs truncate max-w-sm">{user.email}</p>
            )}
          </div>
        </div>
      </BlurFade>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleCards.map((card, idx) => {
          const Icon = card.icon;
          const colorClass = COLOR_MAP[card.color] ?? COLOR_MAP["zinc"];
          return (
            <BlurFade key={card.href} delay={0.15 + idx * 0.05} inView>
              <Link
                href={card.href}
                className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl"
              >
                <MagicCard 
                  className="group flex flex-col gap-3 p-5 rounded-2xl border border-zinc-200/60 bg-white/50 backdrop-blur-md shadow-sm transition-all duration-300 h-full cursor-pointer"
                  gradientColor="rgba(99,102,241,0.08)"
                >
                  <div className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${colorClass}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                      {card.label}
                    </span>
                    <p className="text-zinc-500 text-sm leading-relaxed">{card.description}</p>
                  </div>
                </MagicCard>
              </Link>
            </BlurFade>
          );
        })}
      </div>
    </div>
  );
}

// Skeleton shown while DashboardContent loads
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 bg-zinc-200 rounded-lg" />
        <div className="h-4 w-72 bg-zinc-100 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 p-5 rounded-2xl border border-zinc-100 bg-zinc-50 h-32" />
        ))}
      </div>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
