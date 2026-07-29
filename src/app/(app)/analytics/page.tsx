import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { AnalyticsFilters } from "./AnalyticsFilters";
import { Donut, Bars, StatBar, HeatMap } from "./charts";
import { money, initials, timeAgo, cx } from "@/lib/utils";
import type { Lead, Profile } from "@/lib/types";
import {
  Users, PhoneCall, PhoneOff, BadgeCheck, Trophy, XCircle,
  IndianRupee, Percent, CalendarClock, Repeat, Clock, Download,
} from "lucide-react";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

/** Resolve the date-range filter into a concrete [from, to] window. */
function resolveRange(range: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (range === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null as Date | null, label: "This month" };
  }
  if (range === "last_month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 1),
      label: "Last month",
    };
  }
  const days = Number(range) || 30;
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return { from, to: null as Date | null, label: `Last ${days} days` };
}

type Call = { id: string; lead_id: string; agent_id: string | null; outcome: string | null; created_at: string };
type Payment = { id: string; invoice_id: string; amount: number; paid_on: string };
type Inv = { id: string; lead_id: string | null; total: number; amount_paid: number; status: string };

const STATUS_COLOURS: Record<string, string> = {
  new: "#8A8F98",
  contacted: "#B87333",
  qualified: "#D98A4B",
  won: "#3E7C59",
  lost: "#9B4A3B",
};

const OUTCOME_LABELS: Record<string, string> = {
  connected: "Connected",
  no_answer: "No answer",
  busy: "Busy",
  voicemail: "Voicemail",
  wrong_number: "Wrong number",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "30";
  const { from, to, label: rangeLabel } = resolveRange(range);
  const supabase = await createClient();

  const fromIso = from.toISOString();
  const fromDay = ymd(from);

  const [{ data: profiles }, { data: campaignRows }, { data: leadRows }, { data: callRows }, { data: payRows }, { data: invRows }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("active", true),
      supabase.from("campaigns").select("id, name").order("name"),
      supabase.from("leads").select("*").eq("archived", false).gte("created_at", fromIso),
      supabase.from("calls").select("id, lead_id, agent_id, outcome, created_at").gte("created_at", fromIso),
      supabase.from("invoice_payments").select("id, invoice_id, amount, paid_on").gte("paid_on", fromDay),
      supabase.from("invoices").select("id, lead_id, total, amount_paid, status"),
    ]);

  const team = (profiles ?? []) as Profile[];
  const campaigns = (campaignRows ?? []) as { id: string; name: string }[];
  const invoices = (invRows ?? []) as Inv[];

  // --- apply filters -------------------------------------------------------
  let leads = (leadRows ?? []) as Lead[];
  if (to) leads = leads.filter((l) => new Date(l.created_at) < to);
  if (sp.rep) leads = leads.filter((l) => l.assigned_to === sp.rep);
  if (sp.status) leads = leads.filter((l) => l.status === sp.status);
  if (sp.source) leads = leads.filter((l) => l.source === sp.source);
  if (sp.campaign) leads = leads.filter((l) => l.campaign_id === sp.campaign);

  const leadIds = new Set(leads.map((l) => l.id));

  let calls = (callRows ?? []) as Call[];
  if (to) calls = calls.filter((c) => new Date(c.created_at) < to);
  if (sp.rep) calls = calls.filter((c) => c.agent_id === sp.rep);
  // when any lead filter is on, only count calls against those leads
  const leadFiltered = Boolean(sp.status || sp.source || sp.campaign);
  if (leadFiltered) calls = calls.filter((c) => leadIds.has(c.lead_id));

  const invById = new Map(invoices.map((i) => [i.id, i]));
  const leadOwner = new Map(leads.map((l) => [l.id, l.assigned_to]));

  let payments = (payRows ?? []) as Payment[];
  if (to) payments = payments.filter((p) => p.paid_on < ymd(to));
  payments = payments.filter((p) => {
    const inv = invById.get(p.invoice_id);
    if (!inv?.lead_id) return !sp.rep && !leadFiltered; // unlinked money only counts company-wide
    if (leadFiltered && !leadIds.has(inv.lead_id)) return false;
    if (sp.rep && leadOwner.get(inv.lead_id) !== sp.rep) return false;
    return true;
  });

  // --- derived sets --------------------------------------------------------
  const calledLeadIds = new Set(calls.map((c) => c.lead_id));
  const connectedLeadIds = new Set(calls.filter((c) => c.outcome === "connected").map((c) => c.lead_id));

  const byStatus = (s: string) => leads.filter((l) => l.status === s).length;
  const won = byStatus("won");
  const lost = byStatus("lost");
  const qualified = leads.filter((l) => l.status === "qualified" || l.status === "won").length;
  const open = leads.filter((l) => l.status !== "won" && l.status !== "lost").length;
  const called = leads.filter((l) => calledLeadIds.has(l.id)).length;
  const connected = leads.filter((l) => connectedLeadIds.has(l.id)).length;
  const followUps = leads.filter((l) => l.followups_enabled && l.next_followup_at).length;
  const todayStr = ymd(new Date());
  const overdueFollowUps = leads.filter(
    (l) => l.followups_enabled && l.next_followup_at && l.next_followup_at < todayStr
  ).length;

  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const callsToday = calls.filter((c) => c.created_at.slice(0, 10) === todayStr).length;
  const avgDeal = won ? Math.round(collected / won) : 0;
  const callsPerLead = leads.length ? (calls.length / leads.length).toFixed(1) : "0.0";

  const outstanding = invoices
    .filter((i) => ["sent", "partially_paid"].includes(i.status))
    .filter((i) => !sp.rep || (i.lead_id && leadOwner.get(i.lead_id) === sp.rep))
    .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0);

  // --- KPI cards -----------------------------------------------------------
  const kpis = [
    { label: "Total leads", value: String(leads.length), sub: `${rangeLabel}`, icon: Users },
    { label: "Called", value: String(called), sub: `${pct(called, leads.length)}% of leads`, icon: PhoneCall },
    { label: "Not called", value: String(leads.length - called), sub: `${pct(leads.length - called, leads.length)}% untouched`, icon: PhoneOff, warn: leads.length - called > 0 },
    { label: "Connected", value: String(connected), sub: `${pct(connected, called)}% of called`, icon: PhoneCall },
    { label: "Qualified", value: String(qualified), sub: `${pct(qualified, leads.length)}% of leads`, icon: BadgeCheck },
    { label: "Won", value: String(won), sub: `${pct(won, leads.length)}% conversion`, icon: Trophy, good: true },
    { label: "Lost", value: String(lost), sub: `${pct(lost, leads.length)}% of leads`, icon: XCircle },
    { label: "Open", value: String(open), sub: "still in play", icon: Clock },
    { label: "Follow-ups", value: String(followUps), sub: overdueFollowUps ? `${overdueFollowUps} overdue` : "none overdue", icon: CalendarClock, warn: overdueFollowUps > 0 },
    { label: "Collected", value: money(collected), sub: `${payments.length} payment${payments.length === 1 ? "" : "s"}`, icon: IndianRupee, good: collected > 0 },
    { label: "Average deal", value: won ? money(avgDeal) : "—", sub: "collected ÷ won", icon: Percent },
    { label: "Calls per lead", value: callsPerLead, sub: `${calls.length} calls, ${callsToday} today`, icon: Repeat },
  ];

  // --- funnel --------------------------------------------------------------
  const funnel = [
    { label: "Leads assigned", n: leads.length },
    { label: "Calls attempted", n: called },
    { label: "Connected", n: connected },
    { label: "Qualified", n: qualified },
    { label: "Follow-up scheduled", n: followUps },
    { label: "Won", n: won },
  ];

  // --- daily series --------------------------------------------------------
  const spanDays = Math.min(
    60,
    Math.max(7, Math.round((Date.now() - from.getTime()) / 86_400_000) + 1)
  );
  const days = Array.from({ length: spanDays }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return ymd(d);
  });
  const callSeries = days.map((d) => ({ label: d.slice(5), n: calls.filter((c) => c.created_at.slice(0, 10) === d).length }));
  const leadSeries = days.map((d) => ({ label: d.slice(5), n: leads.filter((l) => l.created_at.slice(0, 10) === d).length }));
  const moneySeries = days.map((d) => ({
    label: d.slice(5),
    n: payments.filter((p) => p.paid_on === d).reduce((s, p) => s + Number(p.amount), 0),
  }));

  // --- heat map (weekday × hour) -------------------------------------------
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const c of calls) {
    const d = new Date(c.created_at);
    grid[d.getDay()][d.getHours()] += 1;
  }

  // --- lead ageing ---------------------------------------------------------
  const ageBuckets = [
    { label: "Under 1 day", max: 1 },
    { label: "1–3 days", max: 3 },
    { label: "3–7 days", max: 7 },
    { label: "7–15 days", max: 15 },
    { label: "15–30 days", max: 30 },
    { label: "30+ days", max: Infinity },
  ];
  const openLeads = leads.filter((l) => l.status !== "won" && l.status !== "lost");
  const ageing = ageBuckets.map((b, i) => {
    const lower = i === 0 ? 0 : ageBuckets[i - 1].max;
    const n = openLeads.filter((l) => {
      const age = (Date.now() - new Date(l.created_at).getTime()) / 86_400_000;
      return age >= lower && age < b.max;
    }).length;
    return { label: b.label, n };
  });

  // --- operator table ------------------------------------------------------
  const rows = team.map((p) => {
    const mine = leads.filter((l) => l.assigned_to === p.id);
    const mineIds = new Set(mine.map((l) => l.id));
    const myCalls = calls.filter((c) => c.agent_id === p.id);
    const myCalled = mine.filter((l) => calledLeadIds.has(l.id)).length;
    const myConnected = mine.filter((l) => connectedLeadIds.has(l.id)).length;
    const myWon = mine.filter((l) => l.status === "won").length;
    const myLost = mine.filter((l) => l.status === "lost").length;
    const myMoney = payments
      .filter((x) => {
        const inv = invById.get(x.invoice_id);
        return inv?.lead_id ? mineIds.has(inv.lead_id) : false;
      })
      .reduce((s, x) => s + Number(x.amount), 0);

    return {
      id: p.id,
      name: p.full_name ?? p.email,
      email: p.email,
      role: p.role,
      leads: mine.length,
      calls: myCalls.length,
      called: myCalled,
      notCalled: mine.length - myCalled,
      connected: myConnected,
      qualified: mine.filter((l) => l.status === "qualified" || l.status === "won").length,
      followUps: mine.filter((l) => l.followups_enabled && l.next_followup_at).length,
      won: myWon,
      lost: myLost,
      open: mine.filter((l) => l.status !== "won" && l.status !== "lost").length,
      money: myMoney,
      close: pct(myWon, mine.length),
    };
  }).sort((a, b) => b.money - a.money || b.won - a.won);

  const bestClose = Math.max(0, ...rows.map((r) => r.close));

  // --- activity timeline ---------------------------------------------------
  const nameOf = new Map(team.map((t) => [t.id, t.full_name ?? t.email]));
  const leadName = new Map(leads.map((l) => [l.id, l.business_name]));
  const timeline = [
    ...calls.map((c) => ({
      at: c.created_at,
      who: nameOf.get(c.agent_id ?? "") ?? "Someone",
      what: `called ${leadName.get(c.lead_id) ?? "a lead"}`,
      tag: OUTCOME_LABELS[c.outcome ?? ""] ?? c.outcome ?? "",
      tone: c.outcome === "connected" ? "text-emerald-700" : "text-muted",
    })),
    ...payments.map((p) => ({
      at: `${p.paid_on}T12:00:00`,
      who: "Payment",
      what: `received ${money(Number(p.amount))}`,
      tag: "",
      tone: "text-emerald-700",
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 14);

  const operatorOptions = team.map((t) => ({ value: t.id, label: t.full_name ?? t.email }));
  const campaignOptions = campaigns.map((c) => ({ value: c.id, label: c.name }));
  const selectedName = sp.rep ? nameOf.get(sp.rep) ?? null : null;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`${selectedName ?? "All operators"} · ${rangeLabel}`}
        action={
          <Link href="/api/leads/export" className="btn-outline">
            <Download className="h-4 w-4" /> Export CSV
          </Link>
        }
      />

      <AnalyticsFilters
        operators={operatorOptions}
        campaigns={campaignOptions}
        active={{
          range,
          rep: sp.rep ?? "",
          status: sp.status ?? "",
          source: sp.source ?? "",
          campaign: sp.campaign ?? "",
        }}
      />

      {/* KPI grid */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{k.label}</p>
              <k.icon
                className={cx(
                  "h-4 w-4",
                  k.good ? "text-emerald-600" : k.warn ? "text-amber-600" : "text-muted"
                )}
              />
            </div>
            <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{k.value}</p>
            <p className={cx("mt-0.5 text-xs", k.warn ? "text-amber-700" : "text-muted")}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* funnel + status donut */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <p className="font-display text-base font-semibold">Lead funnel</p>
          <p className="mt-1 text-sm text-muted">
            Each stage as a share of leads in this window, with drop-off from the step above.
          </p>
          <div className="mt-4 space-y-3">
            {funnel.map((f, i) => {
              const prev = i === 0 ? f.n : funnel[i - 1].n;
              const drop = prev - f.n;
              return (
                <div key={f.label}>
                  <StatBar label={f.label} n={f.n} of={leads.length} />
                  {i > 0 && drop > 0 && (
                    <p className="mt-0.5 text-[11px] text-muted">
                      −{drop} lost from previous step ({pct(drop, prev)}% drop-off)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-display text-base font-semibold">Leads by status</p>
          <p className="mt-1 mb-4 text-sm text-muted">Click a status in the filter bar to drill in.</p>
          <Donut
            total={leads.length}
            centreLabel={`${leads.length} leads`}
            slices={["new", "contacted", "qualified", "won", "lost"].map((s) => ({
              label: s === "contacted" ? "Called" : s[0].toUpperCase() + s.slice(1),
              n: byStatus(s),
              color: STATUS_COLOURS[s],
            }))}
          />
        </div>
      </div>

      {/* call analytics */}
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <div className="card p-5">
          <p className="font-display text-base font-semibold">Call outcomes</p>
          <p className="mt-1 text-sm text-muted">{calls.length} calls logged</p>
          <div className="mt-4 space-y-3">
            {Object.entries(OUTCOME_LABELS).map(([k, l]) => (
              <StatBar
                key={k}
                label={l}
                n={calls.filter((c) => c.outcome === k).length}
                of={calls.length}
                tone={k === "connected" ? "bg-emerald-600" : "bg-copper"}
              />
            ))}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <p className="font-display text-base font-semibold">Calls per day</p>
          <p className="mt-1 text-sm text-muted">{rangeLabel} · {callsToday} today</p>
          <Bars data={callSeries} />
        </div>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <p className="font-display text-base font-semibold">New leads per day</p>
          <Bars data={leadSeries} />
        </div>
        <div className="card p-5">
          <p className="font-display text-base font-semibold">Collections per day</p>
          <p className="mt-1 text-sm text-muted">
            {money(collected)} in · {money(outstanding)} still outstanding
          </p>
          <Bars data={moneySeries} format={(n) => money(n)} />
        </div>
      </div>

      {/* heat map + ageing */}
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <p className="font-display text-base font-semibold">When calls actually happen</p>
          <p className="mt-1 text-sm text-muted">Weekday against hour of day.</p>
          <HeatMap grid={grid} />
        </div>
        <div className="card p-5">
          <p className="font-display text-base font-semibold">Lead ageing</p>
          <p className="mt-1 text-sm text-muted">
            {openLeads.length} open leads by how long they&rsquo;ve been sitting.
          </p>
          <div className="mt-4 space-y-3">
            {ageing.map((a, i) => (
              <StatBar
                key={a.label}
                label={a.label}
                n={a.n}
                of={openLeads.length}
                tone={i >= 4 ? "bg-red-500" : i >= 3 ? "bg-amber-500" : "bg-copper"}
              />
            ))}
          </div>
        </div>
      </div>

      {/* operator table */}
      <div className="card mb-5 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <p className="font-display text-base font-semibold">Operator performance</p>
          <p className="mt-0.5 text-sm text-muted">Click a name to filter everything above to them.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Operator</th>
                <th className="th text-right">Leads</th>
                <th className="th text-right">Called</th>
                <th className="th text-right">Not called</th>
                <th className="th text-right">Connected</th>
                <th className="th text-right">Qualified</th>
                <th className="th text-right">Follow-ups</th>
                <th className="th text-right">Won</th>
                <th className="th text-right">Lost</th>
                <th className="th text-right">Open</th>
                <th className="th text-right">Collected</th>
                <th className="th">Close rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cx(
                    "border-b border-line last:border-0 hover:bg-black/[0.015]",
                    sp.rep === r.id && "bg-copper/[0.05]"
                  )}
                >
                  <td className="td">
                    <Link
                      href={`/analytics?range=${range}&rep=${r.id}`}
                      className="flex items-center gap-2.5"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-copper text-xs font-semibold text-white">
                        {initials(r.name, r.email)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium hover:text-copper">{r.name}</span>
                        <span className="block text-xs capitalize text-muted">{r.role}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="td text-right tabular-nums">{r.leads}</td>
                  <td className="td text-right tabular-nums">{r.called}</td>
                  <td className={cx("td text-right tabular-nums", r.notCalled > 0 && "text-amber-700")}>
                    {r.notCalled}
                  </td>
                  <td className="td text-right tabular-nums">{r.connected}</td>
                  <td className="td text-right tabular-nums">{r.qualified}</td>
                  <td className="td text-right tabular-nums">{r.followUps}</td>
                  <td className="td text-right font-medium tabular-nums text-emerald-700">{r.won}</td>
                  <td className="td text-right tabular-nums">{r.lost}</td>
                  <td className="td text-right tabular-nums">{r.open}</td>
                  <td className="td text-right font-medium tabular-nums">{money(r.money)}</td>
                  <td className="td w-40">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                        <div
                          className={cx(
                            "h-full rounded-full",
                            r.close === bestClose && r.close > 0 ? "bg-emerald-600" : "bg-copper"
                          )}
                          style={{ width: `${r.close}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs tabular-nums">{r.close}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="td text-muted" colSpan={12}>No active team members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* activity */}
      <div className="card p-5">
        <p className="font-display text-base font-semibold">Recent activity</p>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing logged in this window.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {timeline.map((t, i) => (
              <li key={i} className="flex items-baseline gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs tabular-nums text-muted">{timeAgo(t.at)}</span>
                <span className="flex-1">
                  <span className="font-medium">{t.who}</span> {t.what}
                </span>
                {t.tag && <span className={cx("text-xs", t.tone)}>{t.tag}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
