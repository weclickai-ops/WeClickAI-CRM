import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { money } from "@/lib/utils";
import { Phone, Trophy, IndianRupee, Users } from "lucide-react";
import type { Lead, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Local YYYY-MM-DD — never toISOString(), which shifts to UTC. */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function pct(part: number, whole: number) {
  if (!whole) return null;
  return Math.round((part / whole) * 100);
}

type Call = {
  id: string; lead_id: string; agent_id: string | null;
  outcome: string | null; created_at: string;
};
type Payment = { id: string; invoice_id: string; amount: number; paid_on: string };
type Inv = { id: string; lead_id: string | null };
type LeadRow = Pick<Lead, "id" | "assigned_to" | "status">;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const since = daysAgo(29).toISOString();

  const [{ data: profiles }, { data: calls }, { data: leads }, { data: payments }, { data: invoices }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("active", true),
      supabase.from("calls").select("id, lead_id, agent_id, outcome, created_at").gte("created_at", since),
      supabase.from("leads").select("id, assigned_to, status").eq("archived", false),
      supabase.from("invoice_payments").select("id, invoice_id, amount, paid_on").gte("paid_on", ymd(daysAgo(29))),
      supabase.from("invoices").select("id, lead_id"),
    ]);

  const team = (profiles ?? []) as Profile[];
  const allCalls = (calls ?? []) as Call[];
  const allLeads = (leads ?? []) as LeadRow[];
  const allPayments = (payments ?? []) as Payment[];
  const invById = new Map(((invoices ?? []) as Inv[]).map((i) => [i.id, i]));
  const leadOwner = new Map(allLeads.map((l) => [l.id, l.assigned_to]));

  const today = ymd(new Date());
  const weekStart = ymd(daysAgo(6));
  const day = (iso: string) => iso.slice(0, 10);

  /** Revenue follows the rep the lead is assigned to — you assign those by hand. */
  function ownerOfPayment(p: Payment) {
    const inv = invById.get(p.invoice_id);
    if (!inv?.lead_id) return null;
    return leadOwner.get(inv.lead_id) ?? null;
  }

  /** Everything for one rep, or the whole team when id is null. */
  function statsFor(id: string | null) {
    const mineCalls = id ? allCalls.filter((c) => c.agent_id === id) : allCalls;
    const mineLeads = id ? allLeads.filter((l) => l.assigned_to === id) : allLeads;
    const minePay = id ? allPayments.filter((p) => ownerOfPayment(p) === id) : allPayments;

    return {
      assigned: mineLeads.length,
      touched: new Set(mineCalls.map((c) => c.lead_id)).size,
      qualified: mineLeads.filter((l) => l.status === "qualified" || l.status === "won").length,
      won: mineLeads.filter((l) => l.status === "won").length,
      callsToday: mineCalls.filter((c) => day(c.created_at) === today).length,
      callsWeek: mineCalls.filter((c) => day(c.created_at) >= weekStart).length,
      callsMonth: mineCalls.length,
      connected: mineCalls.filter((c) => c.outcome === "connected").length,
      revToday: minePay.filter((p) => p.paid_on === today).reduce((s, p) => s + Number(p.amount), 0),
      revWeek: minePay.filter((p) => p.paid_on >= weekStart).reduce((s, p) => s + Number(p.amount), 0),
      revMonth: minePay.reduce((s, p) => s + Number(p.amount), 0),
    };
  }

  const selected = sp.rep && team.some((t) => t.id === sp.rep) ? sp.rep : null;
  const view = statsFor(selected);
  const me = team.find((t) => t.id === selected);
  const selectedName = me ? (me.full_name ?? me.email) : null;

  const rows = team
    .map((p) => ({ id: p.id, name: p.full_name ?? p.email, role: p.role, ...statsFor(p.id) }))
    .sort((a, b) => b.revMonth - a.revMonth || b.won - a.won);

  const unattributed = allPayments
    .filter((p) => ownerOfPayment(p) === null)
    .reduce((s, x) => s + Number(x.amount), 0);

  // Funnel: each step as a share of the leads that rep was handed.
  const funnel = [
    { label: "Leads assigned", n: view.assigned },
    { label: "Actually called", n: view.touched },
    { label: "Qualified", n: view.qualified },
    { label: "Won", n: view.won },
  ];

  const kpis = [
    { label: "Calls today", value: String(view.callsToday), icon: Phone },
    { label: "Calls (30 days)", value: String(view.callsMonth), icon: Phone },
    { label: "Won", value: String(view.won), icon: Trophy },
    { label: "Collected (30 days)", value: money(view.revMonth), icon: IndianRupee },
  ];

  const Tab = ({ href, label, on }: { href: string; label: string; on: boolean }) => (
    <Link
      href={href}
      className={`chip border px-3 py-1.5 text-[13px] ${
        on ? "border-copper bg-copper/10 text-copper" : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={selectedName ? `${selectedName} · last 30 days` : "Whole team · last 30 days"}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Tab href="/analytics" label="Whole team" on={!selected} />
        {team.map((t) => (
          <Tab
            key={t.id}
            href={`/analytics?rep=${t.id}`}
            label={t.full_name ?? t.email}
            on={selected === t.id}
          />
        ))}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{k.label}</p>
              <k.icon className="h-4 w-4 text-muted" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <p className="font-display text-base font-semibold">
            Lead funnel{selectedName ? ` — ${selectedName}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">Every step as a share of the leads assigned.</p>
          <div className="mt-4 space-y-3">
            {funnel.map((f) => {
              const p = pct(f.n, view.assigned);
              return (
                <div key={f.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{f.label}</span>
                    <span className="tabular-nums">
                      <span className="font-medium">{f.n}</span>
                      {p !== null && <span className="ml-2 text-muted">{p}%</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-copper" style={{ width: `${p ?? 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-display text-base font-semibold">Collections</p>
          <p className="mt-1 text-sm text-muted">
            Payments recorded against invoices raised on these leads.
          </p>
          <div className="mt-4 space-y-3">
            {[
              { k: "Today", v: view.revToday },
              { k: "Last 7 days", v: view.revWeek },
              { k: "Last 30 days", v: view.revMonth },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
                <span className="text-sm text-muted">{r.k}</span>
                <span className="font-display text-lg font-semibold">{money(r.v)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="text-muted">Average per won lead</span>
              <span className="font-medium">
                {view.won ? money(Math.round(view.revMonth / view.won)) : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="th">Rep</th>
              <th className="th text-right">Leads</th>
              <th className="th text-right">Calls 30d</th>
              <th className="th text-right">Today</th>
              <th className="th text-right">Connected</th>
              <th className="th text-right">Won</th>
              <th className="th text-right">Close rate</th>
              <th className="th text-right">Collected 30d</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const close = pct(r.won, r.assigned);
              const conn = pct(r.connected, r.callsMonth);
              return (
                <tr
                  key={r.id}
                  className={`border-b border-line last:border-0 hover:bg-black/[0.015] ${
                    selected === r.id ? "bg-copper/[0.05]" : ""
                  }`}
                >
                  <td className="td">
                    <Link href={`/analytics?rep=${r.id}`} className="font-medium hover:text-copper">
                      {r.name}
                    </Link>
                    <div className="text-xs capitalize text-muted">{r.role}</div>
                  </td>
                  <td className="td text-right">{r.assigned}</td>
                  <td className="td text-right">{r.callsMonth}</td>
                  <td className="td text-right">{r.callsToday}</td>
                  <td className="td text-right">
                    {conn === null ? <span className="text-muted">—</span> : `${conn}%`}
                  </td>
                  <td className="td text-right">{r.won}</td>
                  <td className="td text-right">
                    {close === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={close >= 20 ? "font-medium text-emerald-700" : ""}>{close}%</span>
                    )}
                  </td>
                  <td className="td text-right font-medium">{money(r.revMonth)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="td text-muted" colSpan={8}>
                  <Users className="mr-1.5 inline h-4 w-4" />
                  No active team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Close rate is won leads over leads assigned, so it only means anything
        once leads are assigned under Leads. Collections follow the rep on the
        linked lead; payments against invoices with no lead aren&rsquo;t credited
        to anyone
        {unattributed > 0 && <> — {money(unattributed)} in the last 30 days</>}.
      </p>
    </>
  );
}
