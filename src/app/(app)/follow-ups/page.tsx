import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FollowUpDone } from "@/components/leads/FollowUpDone";
import { fmtDay, timeAgo, cx } from "@/lib/utils";
import type { Lead, Profile } from "@/lib/types";
import {
  Phone, CalendarClock, AlertTriangle, Clock, MessageCircle,
  UserX, CheckCircle2,
} from "lucide-react";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function plusDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: team }, { data: leadRows }, { data: callRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("active", true),
    supabase.from("leads").select("*")
      .eq("followups_enabled", true).eq("archived", false)
      .not("next_followup_at", "is", null)
      .order("next_followup_at", { ascending: true }).limit(500),
    supabase.from("calls").select("id, agent_id, created_at")
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  const staff = (team ?? []) as Profile[];
  const nameOf = new Map(staff.map((t) => [t.id, t.full_name ?? t.email]));
  let all = (leadRows ?? []) as Lead[];
  const callsToday = (callRows ?? []) as { agent_id: string | null }[];

  if (sp.assigned) all = all.filter((l) => l.assigned_to === sp.assigned);

  const today = ymd(new Date());
  const tomorrow = plusDays(1);
  const weekEnd = plusDays(7);
  const on = (l: Lead) => l.next_followup_at!;

  const overdue = all.filter((l) => on(l) < today);
  const dueToday = all.filter((l) => on(l) === today);
  const dueTomorrow = all.filter((l) => on(l) === tomorrow);
  const thisWeek = all.filter((l) => on(l) > tomorrow && on(l) <= weekEnd);
  const later = all.filter((l) => on(l) > weekEnd);
  const unassigned = all.filter((l) => !l.assigned_to);
  const neverTouched = all.filter((l) => !l.last_followed_up_at);

  const groups = [
    { key: "overdue", title: "Overdue", note: "Should have been done already.", items: overdue, tone: "text-red-600" },
    { key: "today", title: "Today", note: "Work these before the day ends.", items: dueToday, tone: "text-copper" },
    { key: "tomorrow", title: "Tomorrow", note: "", items: dueTomorrow, tone: "text-ink" },
    { key: "week", title: "This week", note: "", items: thisWeek, tone: "text-ink" },
    { key: "later", title: "Later", note: "", items: later, tone: "text-muted" },
  ].filter((g) => g.items.length > 0);

  const kpis = [
    { label: "Overdue", value: overdue.length, sub: "past due", icon: AlertTriangle, tone: overdue.length ? "text-red-600" : "text-muted" },
    { label: "Due today", value: dueToday.length, sub: "on the list now", icon: Clock, tone: dueToday.length ? "text-copper" : "text-muted" },
    { label: "Tomorrow", value: dueTomorrow.length, sub: "coming up", icon: CalendarClock, tone: "text-muted" },
    { label: "Calls logged today", value: callsToday.length, sub: "across the team", icon: CheckCircle2, tone: callsToday.length ? "text-emerald-600" : "text-muted" },
    { label: "Never touched", value: neverTouched.length, sub: "scheduled, no call yet", icon: Clock, tone: neverTouched.length ? "text-amber-600" : "text-muted" },
    { label: "Unassigned", value: unassigned.length, sub: "nobody owns these", icon: UserX, tone: unassigned.length ? "text-red-600" : "text-muted" },
  ];

  // Today's workload per person: what's on their plate, and what they've done.
  const perOwner = staff
    .map((p) => ({
      id: p.id,
      name: p.full_name ?? p.email,
      total: all.filter((l) => l.assigned_to === p.id).length,
      overdue: overdue.filter((l) => l.assigned_to === p.id).length,
      today: dueToday.filter((l) => l.assigned_to === p.id).length,
      done: callsToday.filter((c) => c.agent_id === p.id).length,
    }))
    .filter((r) => r.total > 0 || r.done > 0)
    .sort((a, b) => b.overdue + b.today - (a.overdue + a.today));

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle={
          all.length
            ? `${all.length} scheduled · ${overdue.length} overdue · ${dueToday.length} due today`
            : "Nothing scheduled"
        }
      />

      {all.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 font-medium">No follow-ups scheduled</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
            Open a lead and tap Today, Tomorrow, +3 days or Next week — or tick
            several on the Leads list and use the Follow up button.
          </p>
          <Link href="/leads" className="btn-outline mt-5">Go to leads</Link>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k) => (
              <div key={k.label} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-muted">{k.label}</p>
                  <k.icon className={cx("h-4 w-4", k.tone)} />
                </div>
                <p className="mt-1.5 font-display text-[26px] font-semibold leading-none tabular-nums">
                  {k.value}
                </p>
                <p className="mt-1 text-[11px] text-muted">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* today's board, per rep */}
          {perOwner.length > 0 && (
            <div className="card mb-5 overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <p className="text-[13px] font-medium">Today&rsquo;s board</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  What each person is carrying, and how many calls they&rsquo;ve logged today.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="th">Person</th>
                      <th className="th text-right">Overdue</th>
                      <th className="th text-right">Due today</th>
                      <th className="th text-right">Scheduled</th>
                      <th className="th text-right">Calls today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perOwner.map((o) => (
                      <tr key={o.id} className={cx("border-b border-line last:border-0 hover:bg-black/[0.015]",
                                                   sp.assigned === o.id && "bg-copper/[0.05]")}>
                        <td className="td">
                          <Link href={`/follow-ups?assigned=${o.id}`} className="text-[13px] font-medium hover:text-copper">
                            {o.name}
                          </Link>
                        </td>
                        <td className={cx("td text-right tabular-nums", o.overdue ? "font-medium text-red-600" : "text-muted")}>
                          {o.overdue}
                        </td>
                        <td className={cx("td text-right tabular-nums", o.today ? "font-medium text-copper" : "text-muted")}>
                          {o.today}
                        </td>
                        <td className="td text-right tabular-nums text-muted">{o.total}</td>
                        <td className={cx("td text-right tabular-nums", o.done ? "font-medium text-emerald-700" : "text-muted")}>
                          {o.done}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sp.assigned && (
                <div className="border-t border-line px-4 py-2">
                  <Link href="/follow-ups" className="text-[12px] text-copper hover:underline">
                    Show everyone
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className={cx("font-display text-base font-semibold", g.tone)}>{g.title}</h2>
                  <span className="chip bg-black/5 text-muted">{g.items.length}</span>
                  {g.note && <span className="text-[12px] text-muted">{g.note}</span>}
                </div>

                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px]">
                      <tbody>
                        {g.items.map((l) => (
                          <tr key={l.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                            <td className="td">
                              <Link href={`/leads/${l.id}`} className="font-medium hover:text-copper">
                                {l.business_name}
                              </Link>
                              <div className="text-[11px] text-muted">
                                {[l.person_name, l.city, l.category].filter(Boolean).join(" · ") || "—"}
                              </div>
                            </td>
                            <td className="td"><StatusBadge status={l.status} /></td>
                            <td className={cx("td text-[13px]", l.assigned_to ? "text-muted" : "text-red-600")}>
                              {nameOf.get(l.assigned_to ?? "") ?? "Unassigned"}
                            </td>
                            <td className="td text-[13px]">
                              <span className={g.key === "overdue" ? "font-medium text-red-600" : ""}>
                                {fmtDay(l.next_followup_at)}
                              </span>
                              <div className="text-[11px] text-muted">
                                {l.last_followed_up_at
                                  ? `last touched ${timeAgo(l.last_followed_up_at)}`
                                  : "never touched"}
                                {` · every ${l.followup_interval_days}d`}
                              </div>
                            </td>
                            <td className="td">
                              <div className="flex justify-end gap-1.5">
                                {l.phone && (
                                  <a href={`tel:${l.phone}`} className="btn-outline px-2.5 py-1.5" title="Call">
                                    <Phone className="h-4 w-4" />
                                  </a>
                                )}
                                {l.whatsapp && (
                                  <a href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`}
                                     target="_blank" rel="noopener noreferrer"
                                     className="btn-outline px-2.5 py-1.5" title="WhatsApp">
                                    <MessageCircle className="h-4 w-4" />
                                  </a>
                                )}
                                <FollowUpDone leadId={l.id} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
