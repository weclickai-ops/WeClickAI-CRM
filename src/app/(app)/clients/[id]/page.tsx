import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompletionRing, ProjectCard, AddProject, NotesAndLog, LinkInvoice, UnlinkInvoice } from "./WorkspaceClient";
import { CLIENT_STATUS, HEALTH, projectHealth, daysUntil } from "@/lib/delivery";
import { money, initials, cx, timeAgo } from "@/lib/utils";
import type { Client, Project, Profile, Invoice, ClientActivity } from "@/lib/types";
import {
  ArrowLeft, Mail, Phone, Globe, MapPin, MessageCircle, Clock,
  Receipt, Plus, Activity as ActivityIcon, ExternalLink, User,
} from "lucide-react";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ClientWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: projectRows }, { data: profiles }, { data: invoiceRows }, { data: activityRows }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase.from("projects").select("*").eq("client_id", id).order("created_at"),
      supabase.from("profiles").select("*").eq("active", true),
      supabase.from("invoices").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("client_activity").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(30),
    ]);

  // Invoices raised before this client existed have no client_id — offer them
  // for linking rather than making anyone re-key an invoice.
  const { data: orphanRows } = await supabase
    .from("invoices")
    .select("id, number, client_name, total, currency")
    .is("client_id", null)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!client) notFound();

  const c = client as Client;
  const projects = (projectRows ?? []) as Project[];
  const team = (profiles ?? []) as Profile[];
  const invoices = (invoiceRows ?? []) as Invoice[];
  const activity = (activityRows ?? []) as ClientActivity[];
  const orphans = (orphanRows ?? []) as { id: string; number: string; client_name: string; total: number; currency: string }[];

  const nameOf = new Map(team.map((t) => [t.id, t.full_name ?? t.email]));
  const today = ymd(new Date());

  const billed = invoices
    .filter((i) => !["void", "written_off", "draft"].includes(i.status))
    .reduce((s, i) => s + Number(i.total), 0);
  const paid = invoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const balance = billed - paid;
  const overdueMoney = invoices.some(
    (i) => !["void", "written_off", "draft"].includes(i.status)
      && Number(i.total) - Number(i.amount_paid ?? 0) > 0
      && !!i.due_date && i.due_date < today
  );

  const completion = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0;

  const open = projects.filter((p) => p.status !== "completed");
  const worst = open
    .map((p) => projectHealth(p, { overdueMoney }))
    .sort((a, b) => (a === "critical" ? -1 : b === "critical" ? 1 : a === "attention" ? -1 : 1))[0] ?? "healthy";
  const h = HEALTH[worst];
  const cst = CLIENT_STATUS[c.status];

  const deadlines = open
    .filter((p) => p.delivery_date)
    .sort((a, b) => (a.delivery_date! < b.delivery_date! ? -1 : 1))
    .slice(0, 5);

  const contact = [
    c.email && { icon: Mail, text: c.email, href: `mailto:${c.email}` },
    c.phone && { icon: Phone, text: c.phone, href: `tel:${c.phone}` },
    c.whatsapp && { icon: MessageCircle, text: c.whatsapp, href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}` },
    c.website && { icon: Globe, text: c.website, href: c.website.startsWith("http") ? c.website : `https://${c.website}` },
    (c.address || c.city) && { icon: MapPin, text: [c.address, c.city].filter(Boolean).join(", ") },
    { icon: Clock, text: c.timezone },
  ].filter(Boolean) as { icon: any; text: string; href?: string }[];

  return (
    <>
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>

      {/* header */}
      <div className="card mb-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 gap-4">
            {c.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-line object-contain" />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-copper text-base font-semibold text-white">
                {initials(c.company_name, c.email ?? "")}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight">
                  {c.company_name}
                </h1>
                <span className={cx("chip", cst.cls)}>{cst.label}</span>
                <span className={cx("inline-flex items-center gap-1.5 text-[12px]", h.cls)}>
                  <span className={cx("h-1.5 w-1.5 rounded-full", h.bar)} /> {h.label}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-muted">
                {[c.contact_name, c.designation, c.industry].filter(Boolean).join(" · ") || "No contact details yet"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                {contact.map((x, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                    <x.icon className="h-3.5 w-3.5" />
                    {x.href ? (
                      <a href={x.href} target="_blank" rel="noopener noreferrer" className="hover:text-copper">{x.text}</a>
                    ) : x.text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-6">
            <CompletionRing pct={completion} />
            <div className="space-y-2.5 text-[13px]">
              <div>
                <p className="text-[11px] text-muted">Account manager</p>
                <p className="font-medium">{nameOf.get(c.account_manager ?? "") ?? "Unassigned"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Client since</p>
                <p className="font-medium">{c.client_since}</p>
              </div>
              {c.lead_id && (
                <Link href={`/leads/${c.lead_id}`} className="inline-flex items-center gap-1.5 text-[12px] text-copper hover:underline">
                  <User className="h-3.5 w-3.5" /> Original lead
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {/* projects */}
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-[20px] font-semibold tracking-tight">Projects</h2>
              <span className="text-[12px] text-muted">
                {open.length} open · {projects.length - open.length} completed
              </span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} team={team} overdueMoney={overdueMoney} />
              ))}
              <AddProject clientId={c.id} team={team} />
            </div>
          </div>

          <NotesAndLog clientId={c.id} internal={c.notes_internal} clientFacing={c.notes_client} />
        </div>

        {/* rail */}
        <div className="space-y-5">
          {/* money */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-medium">Invoices</p>
              <Link href={`/invoices/new?client=${c.id}`} className="btn-ghost px-2 py-1 text-[12px] text-copper">
                <Plus className="h-3.5 w-3.5" /> New
              </Link>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted">Billed</p>
                <p className="font-display text-[18px] font-semibold tabular-nums">{money(billed)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Outstanding</p>
                <p className={cx("font-display text-[18px] font-semibold tabular-nums",
                                 balance > 0 ? (overdueMoney ? "text-red-600" : "text-amber-700") : "text-emerald-700")}>
                  {money(balance)}
                </p>
              </div>
            </div>

            {invoices.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {invoices.slice(0, 5).map((i) => {
                  const bal = Number(i.total) - Number(i.amount_paid ?? 0);
                  return (
                    <li key={i.id}>
                      <div className="group flex items-center gap-1.5">
                      <Link href={`/invoices/${i.id}`}
                            className="flex flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] hover:bg-black/[0.03]">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{i.number}</span>
                          <span className="block text-[11px] text-muted">{i.due_date ? `due ${i.due_date}` : "no due date"}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block tabular-nums">{money(Number(i.total), i.currency)}</span>
                          {bal > 0 && <span className="block text-[11px] text-amber-700">{money(bal)} due</span>}
                        </span>
                      </Link>
                      <UnlinkInvoice invoiceId={i.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-muted">
                <Receipt className="h-3.5 w-3.5" /> Nothing invoiced yet
              </p>
            )}

            <LinkInvoice clientId={c.id} unlinked={orphans} />
          </div>

          {/* deadlines */}
          <div className="card p-5">
            <p className="text-[14px] font-medium">Upcoming deadlines</p>
            {deadlines.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted">Nothing scheduled.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {deadlines.map((p) => {
                  const left = daysUntil(p.delivery_date);
                  return (
                    <li key={p.id} className="flex items-baseline justify-between gap-2 border-b border-line pb-2 last:border-0">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px]">{p.name}</span>
                        <span className="block text-[11px] text-muted">
                          {nameOf.get(p.owner ?? "") ?? "Unassigned"}
                        </span>
                      </span>
                      <span className={cx("shrink-0 text-[12px] tabular-nums",
                                          left !== null && left < 0 ? "text-red-600" : left !== null && left <= 7 ? "text-amber-700" : "text-muted")}>
                        {left === null ? "—" : left < 0 ? `${Math.abs(left)}d over` : left === 0 ? "today" : `${left}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* activity */}
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-muted" />
              <p className="text-[14px] font-medium">Activity</p>
            </div>
            {activity.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted">Nothing logged yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-copper/60" />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug">{a.summary}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {nameOf.get(a.actor ?? "") ?? "System"} · {timeAgo(a.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
