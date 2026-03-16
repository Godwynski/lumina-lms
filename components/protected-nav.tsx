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

const SETTINGS_LINK: NavItem = {
  href: "/protected/settings",
  label: "Settings Hub",
  icon: Settings,
  roles: ["admin", "librarian", "staff", "student"],
};

const NAV_GROUPS = [
  {
    label: "Library Operations",
    roles: ["admin", "librarian", "staff", "student"],
    sections: [
      {
        id: "circulation",
        label: "Circulation",
        icon: RotateCcw,
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
          { href: "/protected/catalog", label: "Inventory", icon: Library, roles: ["admin", "librarian", "staff"] },
          { href: "/protected/student-catalog", label: "Book Catalog", icon: Library, roles: ["student"] },
          { href: "/protected/resources", label: "Digital Assets", icon: BookOpen, roles: ["admin", "librarian", "staff", "student"] },
        ],
      },
    ]
  },
  {
    label: "Management",
    roles: ["admin", "librarian", "staff"],
    sections: [
      {
        id: "people",
        label: "Resources",
        icon: Users,
        roles: ["admin", "librarian", "staff"],
        children: [
          { href: "/protected/users", label: "Users & Roles", icon: Users, roles: ["admin", "librarian", "staff"] },
          { href: "/protected/admin/approvals", label: "Card Approvals", icon: ShieldCheck, roles: ["admin", "librarian"] },
          { href: "/protected/reports", label: "Analytics", icon: BarChart2, roles: ["admin", "librarian", "staff"] },
        ],
      },
      {
        id: "system",
        label: "System",
        icon: Settings,
        roles: ["admin"],
        children: [
          { href: "/protected/audit", label: "Audit Logs", icon: ShieldCheck, roles: ["admin"] },
          { href: "/protected/settings", label: "System Config", icon: Settings, roles: ["admin"] },
        ],
      },
    ]
  },
  {
    label: "Account",
    roles: ["admin", "librarian", "staff", "student"],
    sections: [
      {
        id: "activity",
        label: "Activity",
        icon: History,
        roles: ["admin", "librarian", "staff", "student"],
        children: [
          { href: "/protected/history", label: "Loan History", icon: History, roles: ["admin", "librarian", "staff", "student"] },
          { href: "/protected/my-card", label: "Library Card", icon: CreditCard, roles: ["staff", "student"] },
          { href: "/protected/fines", label: "Fines & Dues", icon: BookMarked, roles: ["admin", "librarian", "staff", "student"] },
        ],
      },
    ]
  }
];

function LuminaLogo({ size = 20 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 bg-indigo-500/20 blur-[10px] rounded-full scale-150" />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-indigo-600 relative z-10"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <circle cx="12" cy="12" r="3" className="fill-indigo-600/10" />
      </svg>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/protected") return pathname === href;
  return pathname.startsWith(href);
}

function sectionHasActive(pathname: string, section: any) {
  return section.children.some((item: any) => isActive(pathname, item.href));
}

function CollapsibleSection({
  section,
  pathname,
  isExpanded,
  onToggle,
  onItemClick,
}: {
  section: any;
  pathname: string;
  isExpanded: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}) {
  const hasActive = sectionHasActive(pathname, section);
  const Icon = section.icon;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group",
          hasActive || isExpanded
            ? "text-zinc-900 bg-zinc-100/80"
            : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-1.5 rounded-lg transition-colors duration-200",
            hasActive || isExpanded ? "bg-white shadow-sm ring-1 ring-zinc-200" : "bg-transparent group-hover:bg-zinc-100"
          )}>
            <Icon
              size={16}
              className={cn(
                "transition-colors duration-200",
                hasActive || isExpanded ? "text-indigo-600" : "text-zinc-400 group-hover:text-zinc-600"
              )}
            />
          </div>
          <span>{section.label}</span>
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "transition-transform duration-300 ease-in-out text-zinc-400",
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
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden pl-10 pr-2 space-y-0.5"
          >
            {section.children.map((item: any) => {
              const active = isActive(pathname, item.href);
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 relative group",
                    active
                      ? "text-indigo-700 font-semibold"
                      : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  {active && (
                    <motion.div 
                      layoutId="activeSubNav"
                      className="absolute left-0 w-1 h-4 bg-indigo-500 rounded-full"
                    />
                  )}
                  <ItemIcon
                    size={14}
                    className={cn(
                      "transition-colors duration-200",
                      active ? "text-indigo-600" : "text-zinc-300 group-hover:text-zinc-500"
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
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() as Role : null;
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const visibleDashboard = normalizedRole && DASHBOARD_LINK.roles.includes(normalizedRole) ? DASHBOARD_LINK : null;
  const visibleSettings = normalizedRole && SETTINGS_LINK.roles.includes(normalizedRole) ? SETTINGS_LINK : null;

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      sections: group.sections.filter(section => {
        const canSeeSection = normalizedRole && section.roles.includes(normalizedRole);
        const hasVisibleChildren = section.children.some(child => normalizedRole && child.roles.includes(normalizedRole));
        return canSeeSection && hasVisibleChildren;
      }).map(section => ({
        ...section,
        children: section.children.filter(child => normalizedRole && child.roles.includes(normalizedRole))
      }))
    })).filter(group => group.sections.length > 0 && (!normalizedRole || group.roles.includes(normalizedRole)));
  }, [normalizedRole]);

  useEffect(() => {
    const savedExpanded = localStorage.getItem("lumina_sidebar_expanded");
    if (savedExpanded) {
      try {
        setExpandedSections(JSON.parse(savedExpanded));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    filteredGroups.forEach(group => {
      group.sections.forEach(section => {
        if (sectionHasActive(pathname, section) && !expandedSections[section.id]) {
          setExpandedSections(prev => {
            const next = { ...prev, [section.id]: true };
            localStorage.setItem("lumina_sidebar_expanded", JSON.stringify(next));
            return next;
          });
        }
      });
    });
  }, [pathname, filteredGroups]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("lumina_sidebar_expanded", JSON.stringify(next));
      return next;
    });
  };

  const moduleName = useMemo(() => {
    const allItems = [
      DASHBOARD_LINK,
      SETTINGS_LINK,
      ...NAV_GROUPS.flatMap(g => g.sections).flatMap(s => s.children)
    ];
    const match = allItems.find(item => isActive(pathname, item.href));
    return match?.label ?? "Dashboard";
  }, [pathname]);

  const NavContent = ({ onMobileClick }: { onMobileClick?: () => void }) => (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-hide">
      {/* Dashboard & Settings directly at the top */}
      <div className="space-y-1">
        {visibleDashboard && (
          <Link
            href={visibleDashboard.href}
            onClick={onMobileClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
              isActive(pathname, visibleDashboard.href)
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              isActive(pathname, visibleDashboard.href) ? "bg-white/20" : "bg-transparent group-hover:bg-zinc-100"
            )}>
              <visibleDashboard.icon size={16} />
            </div>
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
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            )}
          >
             <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              isActive(pathname, visibleSettings.href) ? "bg-white/20" : "bg-transparent group-hover:bg-zinc-100"
            )}>
              <visibleSettings.icon size={16} />
            </div>
            {visibleSettings.label}
          </Link>
        )}
      </div>

      {filteredGroups.map((group) => (
        <div key={group.label} className="space-y-2">
          <h3 className="px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
            {group.label}
          </h3>
          <div className="space-y-1">
            {group.sections.map((section) => (
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
      ))}
    </div>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[60] flex items-center h-16 px-4 bg-white/80 backdrop-blur-md border-b border-zinc-200/50 md:hidden">
        <button
          aria-label="Toggle navigation menu"
          onClick={() => setIsOpen((value) => !value)}
          className="p-2 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl transition-colors"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex-1 flex justify-center">
           <Link href="/protected" className="flex items-center gap-2">
            <LuminaLogo size={18} />
            <span className="font-bold text-sm text-zinc-900 truncate">{moduleName}</span>
          </Link>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-[55] bg-zinc-900/10 backdrop-blur-[2px]"
              onClick={() => setIsOpen(false)}
            />
            <motion.nav
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-[56] w-[280px] bg-white border-r border-zinc-200/50 flex flex-col shadow-2xl"
            >
              <div className="h-16 flex items-center px-6 border-b border-zinc-50">
                <Link href="/protected" className="flex items-center gap-3">
                  <LuminaLogo size={18} />
                  <span className="font-bold text-zinc-900">Lumina</span>
                </Link>
              </div>
              <NavContent onMobileClick={() => setIsOpen(false)} />
              <div className="p-4 border-t border-zinc-100 bg-zinc-50/30">{authNode}</div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 lg:w-[280px] flex-col bg-white border-r border-zinc-200/50">
        <div className="h-20 flex items-center px-8 shrink-0">
          <Link href="/protected" className="flex items-center gap-4 group">
            <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center transition-all group-hover:scale-105 duration-300 shadow-sm">
              <LuminaLogo size={24} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-zinc-900 leading-none">Lumina</span>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">LMS Platform</span>
            </div>
          </Link>
        </div>

        <NavContent />

        <div className="p-6 border-t border-zinc-100 bg-zinc-50/20">
          <div className="rounded-2xl p-1">
            {authNode}
          </div>
        </div>
      </aside>
    </>
  );
}
