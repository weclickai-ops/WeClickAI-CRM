"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "./Logo";
import { cx, initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import {
  LayoutDashboard, Users, KanbanSquare, Radar, FileText,
  Settings, LogOut, Sparkles, GitBranch,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads",     label: "Leads",     icon: Users },
  { href: "/pipeline",  label: "Pipeline",  icon: KanbanSquare },
  { href: "/campaigns", label: "Campaigns", icon: Radar },
  { href: "/invoices",  label: "Invoices",  icon: FileText },
];

const SETTINGS = [
  { href: "/settings/team",          label: "Team & roles",  icon: Users, adminOnly: true },
  { href: "/settings/custom-fields", label: "Custom fields", icon: Sparkles },
  { href: "/settings/workflows",     label: "Workflows",     icon: GitBranch },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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

  return (
    <aside className="flex w-64 shrink-0 flex-col" style={{ background: "var(--charcoal)" }}>
      <div className="px-5 py-5"><Logo light /></div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => <Item key={n.href} {...n} />)}

        <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
          Settings
        </p>
        {SETTINGS.filter((s) => !s.adminOnly || profile.role === "admin").map((n) => (
          <Item key={n.href} {...n} />
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
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
    </aside>
  );
}
