import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Clock3,
  CreditCard,
  LayoutDashboard,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { OfflinePinGenerator } from "@/components/digital-resources/OfflinePinGenerator";

type Role = "admin" | "librarian" | "staff" | "student" | null;

type Metric = {
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "ok" | "warn";
};

type AttentionItem = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

type QuickAction = {
  label: string;
  description: string;
  href: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  librarian: "Librarian",
  staff: "Staff",
  student: "Student",
};

function formatCount(value: number | null) {
  if (value === null) return "--";
  return new Intl.NumberFormat("en-US").format(value);
}

async function getTableCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

async function getStatusCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  status: string,
) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("status", status);
  if (error) return null;
  return count ?? 0;
}

async function getStatusInCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  statuses: string[],
) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .in("status", statuses);
  if (error) return null;
  return count ?? 0;
}

async function getUserStatusCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userId: string,
  status: string,
) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", status);
  if (error) return null;
  return count ?? 0;
}

function metricTone(value: number | null, warnAt: number): "neutral" | "ok" | "warn" {
  if (value === null) return "neutral";
  return value >= warnAt ? "warn" : "ok";
}

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (await getUserRole()) as Role;

  const [
    totalBooks,
    availableCopies,
    activeBorrowings,
    overdueBorrowings,
    pendingCards,
    unpaidFines,
    totalUsers,
    myActiveBorrowings,
    myOverdueBorrowings,
    myUnpaidFines,
  ] = await Promise.all([
    getTableCount(supabase, "books"),
    getStatusCount(supabase, "book_copies", "AVAILABLE"),
    getStatusCount(supabase, "borrowing_records", "active"),
    getStatusCount(supabase, "borrowing_records", "overdue"),
    getStatusInCount(supabase, "library_cards", ["pending", "PENDING"]),
    getStatusInCount(supabase, "fines", ["unpaid", "open"]),
    getTableCount(supabase, "profiles"),
    user ? getUserStatusCount(supabase, "borrowing_records", user.id, "active") : Promise.resolve(null),
    user ? getUserStatusCount(supabase, "borrowing_records", user.id, "overdue") : Promise.resolve(null),
    user
      ? (async () => {
          const { count, error } = await supabase
            .from("fines")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .in("status", ["unpaid", "open"]);
          if (error) return null;
          return count ?? 0;
        })()
      : Promise.resolve(null),
  ]);

  const staffLike = role === "admin" || role === "librarian" || role === "staff";

  const metrics: Metric[] = staffLike
    ? [
        {
          label: "Active Borrowings",
          value: formatCount(activeBorrowings),
          hint: "Currently checked out books",
          tone: metricTone(activeBorrowings, 25),
        },
        {
          label: "Overdue Items",
          value: formatCount(overdueBorrowings),
          hint: "Needs borrower follow-up",
          tone: metricTone(overdueBorrowings, 1),
        },
        {
          label: "Available Copies",
          value: formatCount(availableCopies),
          hint: `Across ${formatCount(totalBooks)} catalog titles`,
          tone: "ok",
        },
        {
          label: "Pending Card Approvals",
          value: formatCount(pendingCards),
          hint: "Students waiting for validation",
          tone: metricTone(pendingCards, 1),
        },
      ]
    : [
        {
          label: "My Active Loans",
          value: formatCount(myActiveBorrowings),
          hint: "Books currently borrowed",
          tone: "ok",
        },
        {
          label: "Due/Overdue",
          value: formatCount(myOverdueBorrowings),
          hint: "Items that need immediate action",
          tone: metricTone(myOverdueBorrowings, 1),
        },
        {
          label: "Outstanding Fines",
          value: formatCount(myUnpaidFines),
          hint: "Unpaid or open charges",
          tone: metricTone(myUnpaidFines, 1),
        },
        {
          label: "Available Copies",
          value: formatCount(availableCopies),
          hint: "Ready to borrow right now",
          tone: "ok",
        },
      ];

  const attentionItems: AttentionItem[] = staffLike
    ? [
        {
          title: "Resolve overdue queue",
          description:
            overdueBorrowings === null
              ? "Overdue data unavailable. Verify migration and table access."
              : `${formatCount(overdueBorrowings)} overdue record(s) currently open for follow-up.`,
          href: "/protected/fines",
          cta: "Open Fines",
        },
        {
          title: "Review pending approvals",
          description:
            pendingCards === null
              ? "Approval queue unavailable. Check library_cards table and policies."
              : `${formatCount(pendingCards)} card request(s) waiting in queue.`,
          href: "/protected/admin/approvals",
          cta: "Review Approvals",
        },
        {
          title: "Watch unresolved fines",
          description:
            unpaidFines === null
              ? "Fine records unavailable. Confirm fines table is deployed."
              : `${formatCount(unpaidFines)} unpaid/open fine record(s) need action.`,
          href: "/protected/fines",
          cta: "Process Fines",
        },
      ]
    : [
        {
          title: "Renew due items",
          description:
            myOverdueBorrowings === null
              ? "Loan status currently unavailable. Try refreshing shortly."
              : `${formatCount(myOverdueBorrowings)} item(s) are due or overdue.`,
          href: "/protected/history",
          cta: "Open My History",
        },
        {
          title: "Check card and account status",
          description: "Open your digital card and verify your account details before borrowing.",
          href: "/protected/my-card",
          cta: "Open E-Library Card",
        },
        {
          title: "Clear outstanding charges",
          description:
            myUnpaidFines === null
              ? "Fine balance unavailable. You can still check your history page."
              : `${formatCount(myUnpaidFines)} fine record(s) may block new checkouts.`,
          href: "/protected/fines",
          cta: "View Fines",
        },
      ];

  const quickActions: QuickAction[] =
    role === "admin"
      ? [
          { label: "Start Checkout", description: "Scan student and book QR", href: "/protected/borrow" },
          { label: "Process Return", description: "Finalize returned books", href: "/protected/return" },
          { label: "Approve Cards", description: "Handle queued card requests", href: "/protected/admin/approvals" },
          { label: "Manage Roles", description: "Update user access", href: "/protected/users" },
          { label: "Review Audit", description: "Inspect system activity", href: "/protected/audit" },
          { label: "System Settings", description: "Adjust library policies", href: "/protected/settings" },
        ]
      : role === "librarian"
        ? [
            { label: "Start Checkout", description: "Open circulation checkout", href: "/protected/borrow" },
            { label: "Process Return", description: "Receive returned books", href: "/protected/return" },
            { label: "Catalog", description: "Maintain titles and copies", href: "/protected/catalog" },
            { label: "Approvals", description: "Validate e-library cards", href: "/protected/admin/approvals" },
            { label: "Fines", description: "Resolve borrower balances", href: "/protected/fines" },
            { label: "Reports", description: "Check usage trends", href: "/protected/reports" },
          ]
        : role === "staff"
          ? [
              { label: "Start Checkout", description: "Run counter checkout", href: "/protected/borrow" },
              { label: "Process Return", description: "Mark copies available", href: "/protected/return" },
              { label: "Users", description: "Search and assist patrons", href: "/protected/users" },
              { label: "Catalog", description: "Locate books and copies", href: "/protected/catalog" },
              { label: "Fines", description: "Handle payment/waiver flow", href: "/protected/fines" },
              { label: "History", description: "Verify circulation logs", href: "/protected/history" },
            ]
          : [
              { label: "My History", description: "Track loans and due dates", href: "/protected/history" },
              { label: "My Card", description: "Open your e-library card", href: "/protected/my-card" },
              { label: "Book Catalog", description: "Discover available books", href: "/protected/student-catalog" },
              { label: "Digital Resources", description: "Use e-books and journals", href: "/protected/resources" },
            ];

  const roleLabel = role ? ROLE_LABELS[role] : "Guest";

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-indigo-600" />
              <h1 className="text-2xl font-bold text-zinc-900">Operations Dashboard</h1>
            </div>
            <p className="text-sm text-zinc-600">Focused tasks, alerts, and shortcuts for your current role.</p>
            <p className="text-xs text-zinc-500">Signed in as {roleLabel}{user?.email ? ` - ${user.email}` : ""}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
            <Clock3 className="h-4 w-4" />
            Live operational view
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Today Snapshot</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{metric.label}</p>
              <p
                className={`mt-2 text-3xl font-bold ${
                  metric.tone === "warn"
                    ? "text-rose-700"
                    : metric.tone === "ok"
                      ? "text-emerald-700"
                      : "text-zinc-800"
                }`}
              >
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{metric.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-base font-semibold text-zinc-900">Needs Attention</h2>
          </div>
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <div key={item.title} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-semibold text-zinc-900">{item.title}</p>
                <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
                <Link
                  href={item.href}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-600"
                >
                  {item.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-semibold text-zinc-900">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 transition hover:bg-zinc-50"
              >
                <div>
                  <p className="font-medium text-zinc-900">{action.label}</p>
                  <p className="text-xs text-zinc-500">{action.description}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {(role === "admin" || role === "librarian") && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-semibold text-zinc-900">Offline Emergency Toolkit</h2>
          </div>
          <p className="mb-4 text-sm text-zinc-600">Generate and manage offline PIN access for blackout scenarios.</p>
          <OfflinePinGenerator />
        </section>
      )}

      {!staffLike && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-semibold text-zinc-900">Discover More</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/protected/student-catalog" className="rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50">
              <p className="font-medium text-zinc-900">Browse Student Catalog</p>
              <p className="text-xs text-zinc-500">Find available titles and book details.</p>
            </Link>
            <Link href="/protected/resources" className="rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50">
              <p className="font-medium text-zinc-900">Open Digital Resources</p>
              <p className="text-xs text-zinc-500">Read e-books and journals online.</p>
            </Link>
          </div>
        </section>
      )}

      {role === "admin" && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-semibold text-zinc-900">Admin Oversight</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Total Profiles</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">{formatCount(totalUsers)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Catalog Titles</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">{formatCount(totalBooks)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Configuration</p>
              <Link href="/protected/settings" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-indigo-700">
                Open settings
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-28 rounded-2xl border border-zinc-200 bg-zinc-100" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-zinc-200 bg-zinc-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-2xl border border-zinc-200 bg-zinc-100" />
        <div className="h-72 rounded-2xl border border-zinc-200 bg-zinc-100" />
      </div>
    </div>
  );
}

export const metadata = {
  title: "Dashboard | Lumina LMS",
};

export default function ProtectedPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
