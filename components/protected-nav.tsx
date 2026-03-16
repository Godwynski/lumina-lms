"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart2,
  BookMarked,
  BookOpen,
  ChevronDown,
  CreditCard,
  History,
  LayoutDashboard,
  Library,
  Menu,
  RotateCcw,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "admin" | "librarian" | "staff" | "student" | null;

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
};

type NavSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
  children: NavItem[];
};

const DASHBOARD_LINK: NavItem = {
  href: "/protected",
  label: "Dashboard",
  icon: LayoutDashboard,
  roles: ["admin", "librarian", "staff", "student"],
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: "circulation",
    label: "Circulation",
    icon: ScanLine,
    roles: ["admin", "librarian", "staff"],
    children: [
      { href: "/protected/borrow", label: "Checkout", icon: ScanLine, roles: ["admin", "librarian", "staff"] },
      { href: "/protected/return", label: "Return", icon: RotateCcw, roles: ["admin", "librarian", "staff"] },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    icon: Library,
    roles: ["admin", "librarian", "staff", "student"],
    children: [
      { href: "/protected/catalog", label: "Catalog & Inventory", icon: Library, roles: ["admin", "librarian", "staff"] },
      { href: "/protected/student-catalog", label: "Book Catalog", icon: Library, roles: ["student"] },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    roles: ["admin", "librarian", "staff"],
    children: [
      { href: "/protected/users", label: "Users & Roles", icon: Users, roles: ["admin", "librarian", "staff"] },
      { href: "/protected/admin/approvals", label: "Card Approvals", icon: ShieldCheck, roles: ["admin", "librarian"] },
    ],
  },
  {
    id: "activity",
    label: "My Activity",
    icon: History,
    roles: ["admin", "librarian", "staff", "student"],
    children: [
      { href: "/protected/history", label: "My History", icon: History, roles: ["admin", "librarian", "staff", "student"] },
      { href: "/protected/my-card", label: "E-Library Card", icon: CreditCard, roles: ["staff", "student"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: BookMarked,
    roles: ["admin", "librarian", "staff", "student"],
    children: [
      { href: "/protected/fines", label: "Fines", icon: BookMarked, roles: ["admin", "librarian", "staff", "student"] },
      { href: "/protected/resources", label: "Digital Resources", icon: BookOpen, roles: ["admin", "librarian", "staff", "student"] },
      { href: "/protected/reports", label: "Reports & Analytics", icon: BarChart2, roles: ["admin", "librarian", "staff"] },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Settings,
    roles: ["admin"],
    children: [
      { href: "/protected/audit", label: "Audit Logs", icon: ShieldCheck, roles: ["admin"] },
      { href: "/protected/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

const SECTION_ORDER_BY_ROLE: Record<Exclude<Role, null>, string[]> = {
  admin: ["circulation", "catalog", "operations", "activity"],
  librarian: ["circulation", "catalog", "operations", "activity"],
  staff: ["circulation", "catalog", "operations", "activity"],
  student: ["catalog", "activity", "operations"],
};

const SETTINGS_LINK: NavItem = {
  href: "/protected/settings",
  label: "Settings",
  icon: Settings,
  roles: ["admin", "librarian", "staff", "student"], // Base settings for all
};

function LuminaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-indigo-600 shrink-0"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/protected") return pathname === href;
  return pathname.startsWith(href);
}

function sectionHasActive(pathname: string, section: NavSection) {
  return section.children.some((item) => isActive(pathname, item.href));
}

function CollapsibleSection({
  section,
  pathname,
  isExpanded,
  onToggle,
  onItemClick,
}: {
  section: NavSection;
  pathname: string;
  isExpanded: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}) {
  const hasActive = sectionHasActive(pathname, section);
  const Icon = section.icon;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
          hasActive || isExpanded
            ? "text-zinc-900 bg-zinc-100/50"
            : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon
            size={18}
            className={cn(
              "transition-colors duration-200",
              hasActive || isExpanded ? "text-indigo-600" : "text-zinc-400 group-hover:text-zinc-600"
            )}
          />
          <span>{section.label}</span>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "transition-transform duration-300 ease-in-out",
            isExpanded ? "rotate-0" : "-rotate-90 opacity-40"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden pl-7 space-y-1"
          >
            {section.children.map((item) => {
              const active = isActive(pathname, item.href);
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200",
                    active
                      ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm shadow-indigo-100/50"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                  )}
                >
                  <ItemIcon
                    size={16}
                    className={cn(
                      "transition-colors duration-200 text-zinc-400",
                      active && "text-indigo-600"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProtectedNav({
  authNode,
  role,
}: {
  authNode?: React.ReactNode;
  role?: string | null;
}) {
  const pathname = usePathname();
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : null;
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Navigation Preferences
  const [autoCollapse, setAutoCollapse] = useState(false);

  const visibleDashboard = normalizedRole && DASHBOARD_LINK.roles.includes(normalizedRole as Role) ? DASHBOARD_LINK : null;
  const visibleSettings = normalizedRole && SETTINGS_LINK.roles.includes(normalizedRole as Role) ? SETTINGS_LINK : null;

  const visibleSections = useMemo(() => {
    // Exclude People and Admin from sidebar - they move to Settings Hub
    const excludedIds = ["people", "admin"];

    const filtered = NAV_SECTIONS
      .filter(s => !excludedIds.includes(s.id))
      .map((section) => {
        const children = section.children.filter(
          (item) => normalizedRole && item.roles.includes(normalizedRole as Role),
        );
        return { ...section, children };
      })
      .filter(
        (section) => normalizedRole && section.roles.includes(normalizedRole as Role) && section.children.length > 0,
      );

    if (!normalizedRole) return filtered;
    const order = SECTION_ORDER_BY_ROLE[normalizedRole as Exclude<Role, null>] ?? [];
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...filtered].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  }, [normalizedRole]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const savedExpanded = localStorage.getItem("lumina_sidebar_expanded");
    const savedAutoCollapse = localStorage.getItem("lumina_sidebar_auto_collapse");

    if (savedExpanded) {
      try {
        setExpandedSections(JSON.parse(savedExpanded));
      } catch (e) {
        console.error("Failed to parse sidebar state", e);
      }
    }

    if (savedAutoCollapse) {
      setAutoCollapse(savedAutoCollapse === "true");
    }
  }, []);

  // Expand the section that has the active item if not already open
  useEffect(() => {
    const activeSection = visibleSections.find((s) => sectionHasActive(pathname, s));
    if (activeSection && !expandedSections[activeSection.id]) {
      setExpandedSections((prev) => {
        const next = { ...prev, [activeSection.id]: true };
        localStorage.setItem("lumina_sidebar_expanded", JSON.stringify(next));
        return next;
      });
    }
  }, [pathname, visibleSections]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      let next: Record<string, boolean> = {};

      if (autoCollapse) {
        // In focus mode, close others when opening
        if (!prev[id]) {
          next = { [id]: true };
        } else {
          next = { ...prev, [id]: false };
        }
      } else {
        next = { ...prev, [id]: !prev[id] };
      }

      localStorage.setItem("lumina_sidebar_expanded", JSON.stringify(next));
      return next;
    });
  };

  const moduleName = useMemo(() => {
    const allLinks = [
      visibleDashboard, 
      visibleSettings,
      ...visibleSections.flatMap((section) => section.children),
      ...NAV_SECTIONS.filter(s => ["people", "admin"].includes(s.id)).flatMap(s => s.children) // Still match name if navigated directly
    ].filter(Boolean);
    
    const currentLink = allLinks.find((item) => isActive(pathname, (item as NavItem).href)) as NavItem | undefined;
    return currentLink?.label ?? "Dashboard";
  }, [pathname, visibleDashboard, visibleSettings, visibleSections]);

  const NavContent = ({ onMobileClick }: { onMobileClick?: () => void }) => (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
      <div className="space-y-4">
        <div>
          <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-3 mb-2">
            Main
          </span>
          <div className="space-y-1">
            {visibleDashboard && (
              <Link
                href={visibleDashboard.href}
                onClick={onMobileClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive(pathname, visibleDashboard.href)
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                )}
              >
                <visibleDashboard.icon
                  size={18}
                  className={cn(
                    "transition-colors duration-200",
                    isActive(pathname, visibleDashboard.href) ? "text-white" : "text-zinc-400 group-hover:text-zinc-600"
                  )}
                />
                {visibleDashboard.label}
              </Link>
            )}

            {visibleSettings && (
              <Link
                href={visibleSettings.href}
                onClick={onMobileClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive(pathname, visibleSettings.href)
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                )}
              >
                <visibleSettings.icon
                  size={18}
                  className={cn(
                    "transition-colors duration-200",
                    isActive(pathname, visibleSettings.href) ? "text-white" : "text-zinc-400 group-hover:text-zinc-600"
                  )}
                />
                {visibleSettings.label}
              </Link>
            )}
          </div>
        </div>

        <div>
          <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-3 mb-2">
            Library Work
          </span>
          <div className="space-y-1">
            {visibleSections.map((section) => (
              <CollapsibleSection
                key={section.id}
                section={section}
                pathname={pathname}
                isExpanded={!!expandedSections[section.id]}
                onToggle={() => toggleSection(section.id)}
                onItemClick={onMobileClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[60] flex items-center h-14 px-4 bg-white/80 backdrop-blur-md border-b border-zinc-200/50 md:hidden">
        <button
          aria-label="Toggle navigation menu"
          onClick={() => setIsOpen((value) => !value)}
          className="p-2 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl transition-colors"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="h-4 w-px bg-zinc-200 mx-3" />
        <Link href="/protected" className="shrink-0">
          <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <LuminaLogo size={16} />
          </div>
        </Link>
        <div className="h-4 w-px bg-zinc-200 mx-3" />
        <span className="text-sm font-semibold text-zinc-900 truncate">{moduleName}</span>
      </header>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-[55] bg-zinc-900/20 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.nav
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-[56] w-[280px] bg-white border-r border-zinc-200/50 flex flex-col pt-14 shadow-2xl"
            >
              <NavContent onMobileClick={() => setIsOpen(false)} />
              <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">{authNode}</div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 lg:w-[280px] flex-col bg-white border-r border-zinc-200/50">
        <div className="h-16 flex items-center px-6 shrink-0">
          <Link href="/protected" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-[14px] bg-indigo-50 border border-indigo-100 flex items-center justify-center transition-transform group-hover:scale-105 duration-200 shadow-sm shadow-indigo-100">
              <LuminaLogo size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-zinc-900 leading-none">Lumina LMS</span>
              <span className="text-[10px] text-zinc-400 font-medium">Library System</span>
            </div>
          </Link>
        </div>

        <NavContent />

        <div className="p-4 border-t border-zinc-100">
          <div className="rounded-2xl bg-zinc-50/80 p-1 border border-zinc-100/50">
            {authNode}
          </div>
        </div>
      </aside>
    </>
  );
}
