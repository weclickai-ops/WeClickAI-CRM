"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "./Logo";
import { cx, initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import {
  LayoutDashboard, Users, KanbanSquare, Radar, FileText,
  Settings, LogOut, Sparkles, GitBranch, Wallet,
  BadgeCheck, CalendarClock, Landmark, Building2, Briefcase, Columns3, ExternalLink, BarChart3,
  Menu, X,
} from "lucide-react";

/** The finance platform is a separate deployment on the same Supabase project. */
const FINANCE_URL =
  process.env.NEXT_PUBLIC_FINANCE_URL ?? "https://weclick-ai-finance.vercel.app";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads",     label: "Leads",     icon: Users },
  { href: "/qualified", label: "Qualified", icon: BadgeCheck },
  { href: "/follow-ups",label: "Follow-ups",icon: CalendarClock },
  { href: "/pipeline",  label: "Pipeline",  icon: KanbanSquare },
  { href: "/campaigns", label: "Campaigns", icon: Radar },
  { href: "/clients",   label: "Clients",   icon: Briefcase },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/invoices",  label: "Invoices",  icon: FileText },
];

const SETTINGS = [
  { href: "/settings/team",          label: "Team & roles",  icon: Users, adminOnly: true },
  { href: "/settings/stages",        label: "Lead stages",   icon: Columns3, adminOnly: true },
  { href: "/settings/custom-fields", label: "Custom fields", icon: Sparkles },
  { href: "/settings/company",        label: "Company profile", icon: Building2, adminOnly: true },
  { href: "/settings/bank-accounts",  label: "Bank accounts", icon: Landmark, adminOnly: true },
  { href: "/settings/workflows",     label: "Workflows",     icon: GitBranch },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  // Navigating should close the drawer — otherwise you tap a link and stare at
  // the menu you just used.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Don't let the page behind the drawer scroll under your finger.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const ExternalItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white">
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      <span className="flex-1">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-white/30" />
    </a>
  );

  const Item = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href}
        className={cx(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
        )}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
        {label}
      </Link>
    );
  };

  const panel = (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Logo light />
        <button
          className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {NAV.map((n) => <Item key={n.href} {...n} />)}
        <ExternalItem href={FINANCE_URL} label="Finance" icon={Wallet} />

        <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Settings
        </p>
        {SETTINGS.filter((s) => !s.adminOnly || profile.role === "admin").map((n) => (
          <Item key={n.href} {...n} />
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-copper text-sm font-semibold text-white">
            {initials(profile.full_name, profile.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{profile.full_name ?? profile.email}</p>
            <p className="truncate text-xs capitalize text-white/40">{profile.role}</p>
          </div>
          <button onClick={signOut} title="Sign out"
            className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* phone and tablet — a bar you can reach, with the drawer over it */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 lg:hidden"
        style={{
          background: "var(--charcoal)",
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingBottom: "0.75rem",
        }}
      >
        <button
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo light />
        <span className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-copper text-[12px] font-semibold text-white">
          {initials(profile.full_name, profile.email)}
        </span>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 flex h-full w-[17rem] max-w-[85vw] flex-col overflow-y-auto shadow-2xl"
            style={{
              background: "var(--charcoal)",
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            {panel}
          </aside>
        </div>
      )}

      {/* desktop — unchanged */}
      <aside
        className="hidden w-64 shrink-0 flex-col lg:flex"
        style={{ background: "var(--charcoal)" }}
      >
        {panel}
      </aside>
    </>
  );
}
