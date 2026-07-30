import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { ClientFilters, ClientRowActions } from "./ClientsClient";
import {
  PROJECT_STATUS, CLIENT_STATUS, PRIORITY, HEALTH,
  daysUntil, projectHealth,
} from "@/lib/delivery";
import { money, initials, cx, timeAgo } from "@/lib/utils";
import type { Client, Project, Profile, Invoice, ClientActivity } from "@/lib/types";
import {
  Users, Hammer, CheckCircle2, Clock, AlertTriangle,
  IndianRupee, Receipt, CalendarClock, Plus, Briefcase,
} from "lucide-react";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: clientRows }, { data: projectRows }, { data: profiles }, { data: invoiceRows }, { data: activityRows }] =
    await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("*"),
      supabase.from("profiles").select("*").eq("active", true),
      supabase.from("invoices").select("id, client_id, total, amount_paid, status, due_date"),
      supabase.from("client_activity").select("client_id, summary, created_at").order("created_at", { ascending: false }).limit(400),
    ]);

  const team = (profiles ?? []) as Profile[];
  const nameOf = new Map(team.map((t) => [t.id, t.full_name ?? t.email]));
  const allProjects = (projectRows ?? []) as Project[];
  const invoices = (invoiceRows ?? []) as (Pick<Invoice, "id" | "total" | "amount_paid" | "status" | "due_date"> & { client_id: string | null })[];
  const activity = (activityRows ?? []) as Pick<ClientActivity, "client_id" | "summary" | "created_at">[];

  const today = ymd(new Date());
  const monthStart = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  // ---- roll everything up per client ------------------------------------
  const byClient = new Map<string, Project[]>();
  allProjects.forEach((p) => {
    byClient.set(p.client_id, [...(byClient.get(p.client_id) ?? []), p]);
  });

  const moneyByClient = new Map<string, { billed: number; paid: number; overdue: boolean }>();
  invoices.forEach((i) => {
    if (!i.client_id) return;
    const cur = moneyByClient.get(i.client_id) ?? { billed: 0, paid: 0, overdue: false };
    const live = !["void", "written_off", "draft"].includes(i.status);
    const bal = Number(i.total) - Number(i.amount_paid ?? 0);
    moneyByClient.set(i.client_id, {
      billed: cur.billed + (live ? Number(i.total) : 0),
      paid: cur.paid + Number(i.amount_paid ?? 0),
      overdue: cur.overdue || (live && bal > 0 && !!i.due_date && i.due_date < today),
    });
  });

  const lastSeen = new Map<string, { summary: string; created_at: string }>();
  activity.forEach((a) => {
    if (!lastSeen.has(a.client_id)) lastSeen.set(a.client_id, { summary: a.summary, created_at: a.created_at });
  });

  type Row = {
    client: Client;
    projects: Project[];
    lead: Project | null;
    progress: number;
    billed: number;
    paid: number;
    overdueMoney: boolean;
    health: ReturnType<typeof projectHealth>;
    last: { summary: string; created_at: string } | undefined;
  };

  let rows: Row[] = ((clientRows ?? []) as Client[]).map((client) => {
    const projects = byClient.get(client.id) ?? [];
    const open = projects.filter((p) => p.status !== "completed");
    // the project that most needs looking at: soonest delivery among open ones
    const lead =
      open.slice().sort((a, b) => (a.delivery_date ?? "9999") < (b.delivery_date ?? "9999") ? -1 : 1)[0] ?? projects[0] ?? null;
    const progress = projects.length
      ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
      : 0;
    const m = moneyByClient.get(client.id) ?? { billed: 0, paid: 0, overdue: false };
    return {
      client,
      projects,
      lead,
      progress,
      billed: m.billed,
      paid: m.paid,
      overdueMoney: m.overdue,
      health: lead ? projectHealth(lead, { overdueMoney: m.overdue }) : "healthy",
      last: lastSeen.get(client.id),
    };
  });

  // ---- filters ----------------------------------------------------------
  if (sp.q) {
    const q = sp.q.toLowerCase();
    rows = rows.filter((r) =>
      [
        r.client.company_name, r.client.contact_name, r.client.email,
        r.client.phone, r.client.website, r.client.industry,
        ...r.projects.map((p) => p.name),
        ...r.projects.map((p) => p.service),
      ].some((v) => v?.toLowerCase().includes(q))
    );
  }
  if (sp.service)  rows = rows.filter((r) => r.projects.some((p) => p.service === sp.service));
  if (sp.status)   rows = rows.filter((r) => r.projects.some((p) => p.status === sp.status));
  if (sp.priority) rows = rows.filter((r) => r.projects.some((p) => p.priority === sp.priority));
  if (sp.manager)  rows = rows.filter((r) => r.client.account_manager === sp.manager);
  if (sp.pay === "outstanding") rows = rows.filter((r) => r.billed - r.paid > 0);
  if (sp.pay === "clear")       rows = rows.filter((r) => r.billed - r.paid <= 0);

  // ---- KPIs (across everything, not the filtered view) ------------------
  const activeClients = ((clientRows ?? []) as Client[]).filter((c) => c.status === "active").length;
  const inProgress = allProjects.filter((p) => ["development", "review", "revision"].includes(p.status)).length;
  const completed = allProjects.filter((p) => p.status === "completed").length;
  const waiting = allProjects.filter((p) => p.status === "waiting_client").length;
  const overdue = allProjects.filter(
    (p) => p.status !== "completed" && p.delivery_date && p.delivery_date < today
  ).length;
  const monthRevenue = invoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const pending = invoices
    .filter((i) => !["void", "written_off", "draft"].includes(i.status))
    .reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.amount_paid ?? 0)), 0);
  const soon = allProjects.filter((p) => {
    const d = daysUntil(p.delivery_date);
    return p.status !== "completed" && d !== null && d >= 0 && d <= 14;
  }).length;

  const kpis = [
    { label: "Active clients", value: String(activeClients), sub: `${(clientRows ?? []).length} total`, icon: Users, tone: "text-copper" },
    { label: "In progress", value: String(inProgress), sub: "being built", icon: Hammer, tone: "text-blue-600" },
    { label: "Completed", value: String(completed), sub: "delivered", icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Waiting on client", value: String(waiting), sub: "blocked, not ours", icon: Clock, tone: "text-amber-600" },
    { label: "Overdue", value: String(overdue), sub: "past delivery date", icon: AlertTriangle, tone: overdue ? "text-red-600" : "text-muted" },
    { label: "Collected", value: money(monthRevenue), sub: "all invoices", icon: IndianRupee, tone: "text-emerald-600" },
    { label: "Pending payment", value: money(pending), sub: "still owed", icon: Receipt, tone: pending ? "text-amber-600" : "text-muted" },
    { label: "Due in 14 days", value: String(soon), sub: "deadlines coming", icon: CalendarClock, tone: "text-violet-600" },
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Everyone you're delivering for, and where each project stands."
        action={
          <Link href="/clients/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Add client
          </Link>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4 transition-all duration-200 hover:-translate-y-px hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-muted">{k.label}</p>
              <k.icon className={cx("h-4 w-4", k.tone)} />
            </div>
            <p className="mt-1.5 font-display text-[28px] font-semibold leading-none tabular-nums">{k.value}</p>
            <p className="mt-1 text-[11px] text-muted">{k.sub}</p>
          </div>
        ))}
      </div>

      <ClientFilters
        managers={team.map((t) => ({ value: t.id, label: t.full_name ?? t.email }))}
        active={{
          q: sp.q ?? "", service: sp.service ?? "", status: sp.status ?? "",
          priority: sp.priority ?? "", manager: sp.manager ?? "", pay: sp.pay ?? "",
        }}
      />

      {/* table */}
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-medium">
              {(clientRows ?? []).length === 0 ? "No clients yet" : "Nothing matches those filters"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">
              {(clientRows ?? []).length === 0
                ? "A client is someone you're delivering for — separate from leads, so your pipeline stays clean. Add the first one to get started."
                : "Try clearing a filter or searching for something else."}
            </p>
            {(clientRows ?? []).length === 0 && (
              <Link href="/clients/new" className="btn-primary mt-5">
                <Plus className="h-4 w-4" /> Add your first client
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">Client</th>
                  <th className="th">Service</th>
                  <th className="th">Status</th>
                  <th className="th w-40">Progress</th>
                  <th className="th">Delivery</th>
                  <th className="th">Team</th>
                  <th className="th text-right">Payment</th>
                  <th className="th">Health</th>
                  <th className="th">Last activity</th>
                  <th className="th w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = r.lead ? PROJECT_STATUS[r.lead.status] : null;
                  const cst = CLIENT_STATUS[r.client.status];
                  const left = daysUntil(r.lead?.delivery_date ?? null);
                  const balance = r.billed - r.paid;
                  const h = HEALTH[r.health];

                  return (
                    <tr key={r.client.id} className="group border-b border-line last:border-0 hover:bg-black/[0.012]">
                      <td className="td">
                        <Link href={`/clients/${r.client.id}`} className="flex items-center gap-3">
                          {r.client.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.client.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-line object-contain" />
                          ) : (
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-copper text-[12px] font-semibold text-white">
                              {initials(r.client.company_name, r.client.email ?? "")}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium group-hover:text-copper">
                              {r.client.company_name}
                            </span>
                            <span className="block truncate text-[11px] text-muted">
                              {[r.client.contact_name, r.client.industry].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </span>
                        </Link>
                      </td>

                      <td className="td">
                        <span className="text-[13px]">{r.lead?.service ?? "—"}</span>
                        {r.projects.length > 1 && (
                          <span className="block text-[11px] text-muted">+{r.projects.length - 1} more</span>
                        )}
                      </td>

                      <td className="td">
                        {st ? (
                          <span className={cx("chip", st.cls)}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                            {st.label}
                          </span>
                        ) : (
                          <span className={cx("chip", cst.cls)}>{cst.label}</span>
                        )}
                      </td>

                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                            <div
                              className="h-full rounded-full bg-copper transition-[width] duration-700"
                              style={{ width: `${r.progress}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-[11px] tabular-nums text-muted">{r.progress}%</span>
                        </div>
                      </td>

                      <td className="td">
                        <span className="block text-[13px]">{r.lead?.delivery_date ?? "—"}</span>
                        {left !== null && r.lead?.status !== "completed" && (
                          <span className={cx("block text-[11px]", left < 0 ? "text-red-600" : left <= 7 ? "text-amber-700" : "text-muted")}>
                            {left < 0 ? `${Math.abs(left)}d overdue` : left === 0 ? "due today" : `${left}d left`}
                          </span>
                        )}
                      </td>

                      <td className="td text-[13px] text-muted">
                        {nameOf.get(r.client.account_manager ?? "") ?? "Unassigned"}
                      </td>

                      <td className="td text-right">
                        <span className="block text-[13px] font-medium tabular-nums">{money(r.billed)}</span>
                        {balance > 0 ? (
                          <span className={cx("block text-[11px] tabular-nums", r.overdueMoney ? "text-red-600" : "text-amber-700")}>
                            {money(balance)} due
                          </span>
                        ) : r.billed > 0 ? (
                          <span className="block text-[11px] text-emerald-700">paid</span>
                        ) : (
                          <span className="block text-[11px] text-muted">not invoiced</span>
                        )}
                      </td>

                      <td className="td">
                        <span className={cx("inline-flex items-center gap-1.5 text-[12px]", h.cls)}>
                          <span className={cx("h-1.5 w-1.5 rounded-full", h.bar)} />
                          {h.label}
                        </span>
                        {r.lead && (
                          <span className={cx("block text-[11px]", PRIORITY[r.lead.priority].cls)}>
                            {PRIORITY[r.lead.priority].label} priority
                          </span>
                        )}
                      </td>

                      <td className="td">
                        {r.last ? (
                          <>
                            <span className="block max-w-[14rem] truncate text-[12px]">{r.last.summary}</span>
                            <span className="block text-[11px] text-muted">{timeAgo(r.last.created_at)}</span>
                          </>
                        ) : (
                          <span className="text-[12px] text-muted">nothing logged</span>
                        )}
                      </td>

                      <td className="td">
                        <ClientRowActions id={r.client.id} company={r.client.company_name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Showing {rows.length} of {(clientRows ?? []).length} clients. Health is
          worked out from delivery dates, project status and overdue invoices —
          nothing to set by hand.
        </p>
      )}
    </>
  );
}
