import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsFilters } from "./AnalyticsFilters";
import { Tabs, ActivityRail, type ActivityItem } from "./shell";
import { Funnel, Donut, Spark, StatBar, AgeStrip, HeatMap, Trend, TONE } from "./charts";
import { money, initials, cx } from "@/lib/utils";
import type { Lead, Profile } from "@/lib/types";
import {
  Users, PhoneCall, Trophy, IndianRupee, ArrowRight, PhoneOff,
  BadgeCheck, XCircle, Clock, CalendarClock, Repeat, Target,
} from "lucide-react";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}
/** Percentage change against the previous window. null = nothing to compare. */
function delta(now: number, before: number) {
  if (!before) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 100);
}

/** Current window plus the equivalent window immediately before it. */
function resolveRange(range: string) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);

  if (range === "month") {
    const from = new Date(t.getFullYear(), t.getMonth(), 1);
    return { from, to: null as Date | null, prevFrom: new Date(t.getFullYear(), t.getMonth() - 1, 1), prevTo: from, label: "This month" };
  }
  if (range === "last_month") {
    const from = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const to = new Date(t.getFullYear(), t.getMonth(), 1);
    return { from, to, prevFrom: new Date(t.getFullYear(), t.getMonth() - 2, 1), prevTo: from, label: "Last month" };
  }
  const days = Number(range) || 30;
  const from = new Date(t); from.setDate(from.getDate() - (days - 1));
  const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - days);
  return { from, to: null as Date | null, prevFrom, prevTo: from, label: `Last ${days} days` };
}

type Call = { id: string; lead_id: string; agent_id: string | null; outcome: string | null; created_at: string };
type Payment = { id: string; invoice_id: string; amount: number; paid_on: string };
type Inv = { id: string; lead_id: string | null; total: number; amount_paid: number; status: string };

const STATUS_COLOURS: Record<string, string> = {
  new: TONE.muted, contacted: TONE.leads, qualified: "#F59E0B", won: TONE.won, lost: TONE.lost,
};
const OUTCOMES: Record<string, string> = {
  connected: "Connected", no_answer: "No answer", busy: "Busy",
  voicemail: "Voicemail", wrong_number: "Wrong number",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "30";
  const { from, to, prevFrom, prevTo, label: rangeLabel } = resolveRange(range);
  const supabase = await createClient();

  // Pull both windows in one go, then split — one round trip, real comparisons.
  const [{ data: profiles }, { data: campaignRows }, { data: leadRows }, { data: callRows }, { data: payRows }, { data: invRows }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("active", true),
      supabase.from("campaigns").select("id, name").order("name"),
      supabase.from("leads").select("*").eq("archived", false).gte("created_at", prevFrom.toISOString()),
      supabase.from("calls").select("id, lead_id, agent_id, outcome, created_at").gte("created_at", prevFrom.toISOString()),
      supabase.from("invoice_payments").select("id, invoice_id, amount, paid_on").gte("paid_on", ymd(prevFrom)),
      supabase.from("invoices").select("id, lead_id, total, amount_paid, status"),
    ]);

  const team = (profiles ?? []) as Profile[];
  const campaigns = (campaignRows ?? []) as { id: string; name: string }[];
  const invoices = (invRows ?? []) as Inv[];
  const invById = new Map(invoices.map((i) => [i.id, i]));

  const inWindow = (iso: string, a: Date, b: Date | null) => {
    const d = new Date(iso);
    return d >= a && (!b || d < b);
  };

  // --- filters -------------------------------------------------------------
  const applyLeadFilters = (rows: Lead[]) => {
    let out = rows;
    if (sp.rep) out = out.filter((l) => l.assigned_to === sp.rep);
    if (sp.status) out = out.filter((l) => l.status === sp.status);
    if (sp.source) out = out.filter((l) => l.source === sp.source);
    if (sp.campaign) out = out.filter((l) => l.campaign_id === sp.campaign);
    return out;
  };

  const allLeadRows = (leadRows ?? []) as Lead[];
  const leads = applyLeadFilters(allLeadRows.filter((l) => inWindow(l.created_at, from, to)));
  const prevLeads = applyLeadFilters(allLeadRows.filter((l) => inWindow(l.created_at, prevFrom, prevTo)));

  const leadIds = new Set(leads.map((l) => l.id));
  const leadFiltered = Boolean(sp.status || sp.source || sp.campaign);
  const leadOwner = new Map(allLeadRows.map((l) => [l.id, l.assigned_to]));

  const applyCallFilters = (rows: Call[]) => {
    let out = rows;
    if (sp.rep) out = out.filter((c) => c.agent_id === sp.rep);
    if (leadFiltered) out = out.filter((c) => leadIds.has(c.lead_id));
    return out;
  };
  const allCallRows = (callRows ?? []) as Call[];
  const calls = applyCallFilters(allCallRows.filter((c) => inWindow(c.created_at, from, to)));
  const prevCalls = applyCallFilters(allCallRows.filter((c) => inWindow(c.created_at, prevFrom, prevTo)));

  const payMatches = (p: Payment) => {
    const inv = invById.get(p.invoice_id);
    if (!inv?.lead_id) return !sp.rep && !leadFiltered;
    if (leadFiltered && !leadIds.has(inv.lead_id)) return false;
    if (sp.rep && leadOwner.get(inv.lead_id) !== sp.rep) return false;
    return true;
  };
  const allPayRows = (payRows ?? []) as Payment[];
  const payments = allPayRows.filter((p) => p.paid_on >= ymd(from) && (!to || p.paid_on < ymd(to))).filter(payMatches);
  const prevPayments = allPayRows.filter((p) => p.paid_on >= ymd(prevFrom) && p.paid_on < ymd(prevTo)).filter(payMatches);

  // --- derived -------------------------------------------------------------
  const calledIds = new Set(calls.map((c) => c.lead_id));
  const connectedIds = new Set(calls.filter((c) => c.outcome === "connected").map((c) => c.lead_id));
  const prevCalledIds = new Set(prevCalls.map((c) => c.lead_id));

  const byStatus = (s: string) => leads.filter((l) => l.status === s).length;
  const won = byStatus("won");
  const prevWon = prevLeads.filter((l) => l.status === "won").length;
  const lost = byStatus("lost");
  const qualified = leads.filter((l) => l.status === "qualified" || l.status === "won").length;
  const open = leads.filter((l) => l.status !== "won" && l.status !== "lost").length;
  const called = leads.filter((l) => calledIds.has(l.id)).length;
  const prevCalled = prevLeads.filter((l) => prevCalledIds.has(l.id)).length;
  const connected = leads.filter((l) => connectedIds.has(l.id)).length;

  const today = ymd(new Date());
  const followUps = leads.filter((l) => l.followups_enabled && l.next_followup_at).length;
  const overdue = leads.filter((l) => l.followups_enabled && l.next_followup_at && l.next_followup_at < today).length;

  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const prevCollected = prevPayments.reduce((s, p) => s + Number(p.amount), 0);
  const avgDeal = won ? Math.round(collected / won) : 0;
  const callsToday = calls.filter((c) => c.created_at.slice(0, 10) === today).length;
  const outstanding = invoices
    .filter((i) => ["sent", "partially_paid"].includes(i.status))
    .filter((i) => !sp.rep || (i.lead_id && leadOwner.get(i.lead_id) === sp.rep))
    .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid ?? 0)), 0);

  // --- series --------------------------------------------------------------
  const span = Math.min(60, Math.max(7, Math.round((Date.now() - from.getTime()) / 86_400_000) + 1));
  const days = Array.from({ length: span }, (_, i) => {
    const d = new Date(from); d.setDate(d.getDate() + i); return ymd(d);
  });
  const callSeries = days.map((d) => ({ label: d.slice(5), n: calls.filter((c) => c.created_at.slice(0, 10) === d).length }));
  const leadSeries = days.map((d) => ({ label: d.slice(5), n: leads.filter((l) => l.created_at.slice(0, 10) === d).length }));
  const moneySeries = days.map((d) => ({ label: d.slice(5), n: payments.filter((p) => p.paid_on === d).reduce((s, p) => s + Number(p.amount), 0) }));

  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const c of calls) {
    const d = new Date(c.created_at);
    grid[d.getDay()][d.getHours()] += 1;
  }

  const openLeads = leads.filter((l) => l.status !== "won" && l.status !== "lost");
  const AGE = [
    { label: "Under 1 day", max: 1, color: "#16A34A" },
    { label: "1–3 days", max: 3, color: "#65A30D" },
    { label: "3–7 days", max: 7, color: "#CA8A04" },
    { label: "7–15 days", max: 15, color: "#EA580C" },
    { label: "15–30 days", max: 30, color: "#DC2626" },
    { label: "30+ days", max: Infinity, color: "#991B1B" },
  ];
  const ageing = AGE.map((b, i) => {
    const lower = i === 0 ? 0 : AGE[i - 1].max;
    return {
      label: b.label,
      color: b.color,
      n: openLeads.filter((l) => {
        const age = (Date.now() - new Date(l.created_at).getTime()) / 86_400_000;
        return age >= lower && age < b.max;
      }).length,
    };
  });

  // --- operators -----------------------------------------------------------
  const rows = team.map((p) => {
    const mine = leads.filter((l) => l.assigned_to === p.id);
    const mineIds = new Set(mine.map((l) => l.id));
    const myWon = mine.filter((l) => l.status === "won").length;
    return {
      id: p.id,
      name: p.full_name ?? p.email,
      email: p.email,
      role: p.role,
      leads: mine.length,
      calls: calls.filter((c) => c.agent_id === p.id).length,
      called: mine.filter((l) => calledIds.has(l.id)).length,
      connected: mine.filter((l) => connectedIds.has(l.id)).length,
      qualified: mine.filter((l) => l.status === "qualified" || l.status === "won").length,
      won: myWon,
      lost: mine.filter((l) => l.status === "lost").length,
      open: mine.filter((l) => l.status !== "won" && l.status !== "lost").length,
      money: payments
        .filter((x) => { const inv = invById.get(x.invoice_id); return inv?.lead_id ? mineIds.has(inv.lead_id) : false; })
        .reduce((s, x) => s + Number(x.amount), 0),
      close: pct(myWon, mine.length),
    };
  }).sort((a, b) => b.money - a.money || b.won - a.won);
  const topRevenue = Math.max(1, ...rows.map((r) => r.money));

  // --- activity ------------------------------------------------------------
  const nameOf = new Map(team.map((t) => [t.id, t.full_name ?? t.email]));
  const leadName = new Map(leads.map((l) => [l.id, l.business_name]));
  const activity: ActivityItem[] = [
    ...calls.map((c) => ({
      sort: c.created_at,
      at: new Date(c.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
      who: nameOf.get(c.agent_id ?? "") ?? "Someone",
      what: `called ${leadName.get(c.lead_id) ?? "a lead"}`,
      tag: OUTCOMES[c.outcome ?? ""] ?? "",
      good: c.outcome === "connected",
    })),
    ...payments.map((p) => ({
      sort: `${p.paid_on}T12:00:00`,
      at: new Date(p.paid_on).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      who: "Payment",
      what: `received ${money(Number(p.amount))}`,
      tag: "",
      good: true,
    })),
  ].sort((a, b) => (a.sort < b.sort ? 1 : -1)).slice(0, 25)
    .map(({ sort, ...rest }) => rest);

  const selectedName = sp.rep ? nameOf.get(sp.rep) ?? null : null;
  const qs = new URLSearchParams(sp as Record<string, string>);

  const heroes = [
    { label: "Total leads", value: String(leads.length), trend: delta(leads.length, prevLeads.length), icon: Users, tone: TONE.leads, foot: `${open} still open` },
    { label: "Called", value: String(called), trend: delta(called, prevCalled), icon: PhoneCall, tone: TONE.calls, foot: `${pct(called, leads.length)}% of leads` },
    { label: "Won", value: String(won), trend: delta(won, prevWon), icon: Trophy, tone: TONE.won, foot: `${pct(won, leads.length)}% conversion` },
    { label: "Collected", value: money(collected), trend: delta(collected, prevCollected), icon: IndianRupee, tone: TONE.won, foot: `${money(outstanding)} outstanding` },
  ];

  const minis = [
    { label: "Not called", value: leads.length - called, icon: PhoneOff, warn: leads.length - called > 0 },
    { label: "Connected", value: connected, icon: PhoneCall },
    { label: "Qualified", value: qualified, icon: BadgeCheck },
    { label: "Lost", value: lost, icon: XCircle },
    { label: "Open", value: open, icon: Clock },
    { label: "Follow-ups", value: followUps, icon: CalendarClock, warn: overdue > 0 },
    { label: "Avg deal", value: won ? money(avgDeal) : "—", icon: Target },
    { label: "Calls / lead", value: leads.length ? (calls.length / leads.length).toFixed(1) : "0.0", icon: Repeat },
  ];

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-tight">Analytics</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {selectedName ?? "All operators"} · {rangeLabel}
          </p>
        </div>
      </div>

      <AnalyticsFilters
        operators={team.map((t) => ({ value: t.id, label: t.full_name ?? t.email }))}
        campaigns={campaigns.map((c) => ({ value: c.id, label: c.name }))}
        active={{ range, rep: sp.rep ?? "", status: sp.status ?? "", source: sp.source ?? "", campaign: sp.campaign ?? "" }}
      />

      <div className="flex gap-5">
        <div className="min-w-0 flex-1 space-y-4">
          {/* level 1 — heroes */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {heroes.map((k) => (
              <div
                key={k.label}
                className="card overflow-hidden p-4 transition-all duration-200 hover:-translate-y-px hover:shadow-md"
              >
                <div className="h-[3px] -mx-4 -mt-4 mb-3" style={{ background: k.tone }} />
                <div className="flex items-start justify-between">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-muted">{k.label}</p>
                  <k.icon className="h-4 w-4" style={{ color: k.tone }} />
                </div>
                <p className="mt-1.5 font-display text-[36px] font-semibold leading-none tabular-nums">{k.value}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Trend pct={k.trend} />
                  <span className="truncate text-[11px] text-muted">{k.foot}</span>
                </div>
              </div>
            ))}
          </div>

          {/* level 1b — minis */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {minis.map((m) => (
              <div key={m.label} className="card px-3 py-2.5 transition-colors hover:bg-black/[0.015]">
                <div className="flex items-center gap-1.5">
                  <m.icon className={cx("h-3 w-3", m.warn ? "text-amber-600" : "text-muted")} />
                  <p className="truncate text-[11px] text-muted">{m.label}</p>
                </div>
                <p className={cx("mt-0.5 font-display text-[20px] font-semibold leading-none tabular-nums", m.warn && "text-amber-700")}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* level 2 — funnel + status */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <p className="text-[14px] font-medium">Lead funnel</p>
              <p className="mb-4 mt-0.5 text-[12px] text-muted">Hover a stage for drop-off.</p>
              <Funnel
                stages={[
                  { label: "Assigned", n: leads.length },
                  { label: "Called", n: called },
                  { label: "Connected", n: connected },
                  { label: "Qualified", n: qualified },
                  { label: "Won", n: won },
                ]}
              />
            </div>

            <div className="card p-5">
              <p className="text-[14px] font-medium">Lead status</p>
              <p className="mb-3 mt-0.5 text-[12px] text-muted">Click a status to filter.</p>
              <Donut
                total={leads.length}
                slices={["new", "contacted", "qualified", "won", "lost"].map((s) => {
                  const p = new URLSearchParams(qs); p.set("status", s);
                  return {
                    label: s === "contacted" ? "Called" : s[0].toUpperCase() + s.slice(1),
                    n: byStatus(s),
                    color: STATUS_COLOURS[s],
                    href: `/analytics?${p.toString()}`,
                  };
                })}
              />
            </div>
          </div>

          {/* level 3 — charts, tabbed */}
          <div className="card p-5">
            <Tabs tabs={["Leads", "Calls", "Revenue", "Operators", "Performance"]} fixedHeight={300}>
              {/* Leads */}
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <p className="mb-2 text-[12px] text-muted">New leads per day</p>
                  <Spark data={leadSeries} color={TONE.leads} />
                </div>
                <div>
                  <p className="mb-2 text-[12px] text-muted">{openLeads.length} open leads by age</p>
                  <AgeStrip buckets={ageing} />
                </div>
              </div>

              {/* Calls */}
              <Tabs tabs={["Timeline", "Outcomes", "Heatmap"]}>
                <div>
                  <p className="mb-2 text-[12px] text-muted">{calls.length} calls · {callsToday} today</p>
                  <Spark data={callSeries} color={TONE.calls} />
                </div>
                <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {Object.entries(OUTCOMES).map(([k, l]) => (
                    <StatBar
                      key={k}
                      label={l}
                      n={calls.filter((c) => c.outcome === k).length}
                      of={calls.length}
                      color={k === "connected" ? TONE.won : TONE.calls}
                    />
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-[12px] text-muted">When calls actually happen</p>
                  <HeatMap grid={grid} />
                </div>
              </Tabs>

              {/* Revenue */}
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="space-y-2.5">
                  {[
                    { k: "Today", v: payments.filter((p) => p.paid_on === today).reduce((s, p) => s + Number(p.amount), 0) },
                    { k: rangeLabel, v: collected },
                    { k: "Average deal", v: avgDeal },
                    { k: "Outstanding", v: outstanding },
                  ].map((r) => (
                    <div key={r.k} className="flex items-baseline justify-between border-b border-line pb-2 last:border-0">
                      <span className="text-[12px] text-muted">{r.k}</span>
                      <span className="font-display text-[18px] font-semibold tabular-nums">{money(r.v)}</span>
                    </div>
                  ))}
                </div>
                <div className="lg:col-span-2">
                  <p className="mb-2 text-[12px] text-muted">Collections per day</p>
                  <Spark data={moneySeries} color={TONE.won} format={(n) => money(n)} />
                </div>
              </div>

              {/* Operators — full table */}
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="th">Operator</th>
                      <th className="th text-right">Leads</th>
                      <th className="th text-right">Called</th>
                      <th className="th text-right">Connected</th>
                      <th className="th text-right">Qualified</th>
                      <th className="th text-right">Won</th>
                      <th className="th text-right">Lost</th>
                      <th className="th text-right">Open</th>
                      <th className="th text-right">Collected</th>
                      <th className="th text-right">Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                        <td className="td">
                          <Link href={`/analytics?range=${range}&rep=${r.id}`} className="font-medium hover:text-copper">
                            {r.name}
                          </Link>
                        </td>
                        <td className="td text-right tabular-nums">{r.leads}</td>
                        <td className="td text-right tabular-nums">{r.called}</td>
                        <td className="td text-right tabular-nums">{r.connected}</td>
                        <td className="td text-right tabular-nums">{r.qualified}</td>
                        <td className="td text-right font-medium tabular-nums text-emerald-700">{r.won}</td>
                        <td className="td text-right tabular-nums">{r.lost}</td>
                        <td className="td text-right tabular-nums">{r.open}</td>
                        <td className="td text-right font-medium tabular-nums">{money(r.money)}</td>
                        <td className="td text-right tabular-nums">{r.close}%</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td className="td text-muted" colSpan={10}>No active team members yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Performance */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-[12px] text-muted">Close rate</p>
                  <div className="space-y-3">
                    {rows.map((r) => (
                      <StatBar key={r.id} label={r.name} n={r.won} of={r.leads || 1} color={TONE.won} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-[12px] text-muted">Revenue share</p>
                  <div className="space-y-3">
                    {rows.map((r) => (
                      <div key={r.id}>
                        <div className="flex items-baseline justify-between text-[13px]">
                          <span className="truncate">{r.name}</span>
                          <span className="font-medium tabular-nums">{money(r.money)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                          <div className="h-full rounded-full" style={{ width: `${(r.money / topRevenue) * 100}%`, background: TONE.leads }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Tabs>
          </div>

          {/* level 4 — top 5 */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <p className="text-[14px] font-medium">Top operators</p>
              <span className="text-[12px] text-muted">by collections</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <tbody>
                  {rows.slice(0, 5).map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-copper text-[11px] font-semibold text-white">
                            {initials(r.name, r.email)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium">{r.name}</span>
                            <span className="block text-[11px] capitalize text-muted">{r.role}</span>
                          </span>
                        </div>
                      </td>
                      <td className="td text-right">
                        <span className="block text-[13px] font-medium tabular-nums">{r.leads}</span>
                        <span className="block text-[11px] text-muted">leads</span>
                      </td>
                      <td className="td text-right">
                        <span className="block text-[13px] font-medium tabular-nums text-emerald-700">{r.won}</span>
                        <span className="block text-[11px] text-muted">won</span>
                      </td>
                      <td className="td text-right">
                        <span className="block text-[13px] font-medium tabular-nums">{money(r.money)}</span>
                        <span className="block text-[11px] text-muted">collected</span>
                      </td>
                      <td className="td w-32">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                            <div className="h-full rounded-full" style={{ width: `${r.close}%`, background: TONE.won }} />
                          </div>
                          <span className="w-8 text-right text-[11px] tabular-nums">{r.close}%</span>
                        </div>
                      </td>
                      <td className="td w-10 text-right">
                        <Link href={`/analytics?range=${range}&rep=${r.id}`} className="btn-ghost px-2 py-1.5" title="Drill in">
                          <ArrowRight className="h-4 w-4 text-muted" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td className="td text-muted">No active team members yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* level 5 */}
        <ActivityRail items={activity} />
      </div>
    </>
  );
}
