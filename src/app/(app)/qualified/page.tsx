import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { money, fmtDay, timeAgo, cx } from "@/lib/utils";
import type { Lead, Profile, PipelineStage } from "@/lib/types";
import {
  Phone, CalendarPlus, BadgeCheck, Clock, AlertTriangle,
  UserX, MessageCircle, Globe, FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function QualifiedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const today = ymd(new Date());

  const [{ data: team }, { data: leadRows }, { data: invoiceRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("active", true),
    supabase.from("leads").select("*").eq("status", "qualified").eq("archived", false)
      .order("updated_at", { ascending: false }).limit(300),
    supabase.from("invoices").select("id, lead_id, total, status"),
  ]);

  const staff = (team ?? []) as Profile[];
  const nameOf = new Map(staff.map((t) => [t.id, t.full_name ?? t.email]));
  let all = (leadRows ?? []) as Lead[];

  const quoted = new Set(
    ((invoiceRows ?? []) as { lead_id: string | null; status: string }[])
      .filter((i) => i.lead_id && !["void", "written_off"].includes(i.status))
      .map((i) => i.lead_id as string)
  );

  if (sp.assigned) all = all.filter((l) => l.assigned_to === sp.assigned);

  // Buckets that tell you what to do, rather than one undifferentiated list.
  const overdue = all.filter((l) => l.followups_enabled && l.next_followup_at && l.next_followup_at < today);
  const dueToday = all.filter((l) => l.followups_enabled && l.next_followup_at === today);
  const noFollowUp = all.filter((l) => !l.followups_enabled || !l.next_followup_at);
  const unassigned = all.filter((l) => !l.assigned_to);
  const scheduled = all.filter(
    (l) => l.followups_enabled && l.next_followup_at && l.next_followup_at > today
  );
  const stale = all.filter((l) => daysSince(l.updated_at) >= 14);

  const kpis = [
    { label: "Qualified", value: all.length, sub: "ready to close", icon: BadgeCheck, tone: "text-copper" },
    { label: "Overdue", value: overdue.length, sub: "follow-up missed", icon: AlertTriangle, tone: overdue.length ? "text-red-600" : "text-muted" },
    { label: "Due today", value: dueToday.length, sub: "call these now", icon: Clock, tone: dueToday.length ? "text-amber-600" : "text-muted" },
    { label: "No follow-up", value: noFollowUp.length, sub: "nothing scheduled", icon: CalendarPlus, tone: noFollowUp.length ? "text-amber-600" : "text-muted" },
    { label: "Unassigned", value: unassigned.length, sub: "nobody owns these", icon: UserX, tone: unassigned.length ? "text-red-600" : "text-muted" },
    { label: "Quoted", value: all.filter((l) => quoted.has(l.id)).length, sub: "invoice raised", icon: FileText, tone: "text-emerald-600" },
  ];

  const groups = [
    { key: "overdue", title: "Overdue", note: "Follow-up date has passed.", items: overdue, tone: "text-red-600" },
    { key: "today", title: "Due today", note: "Scheduled for today.", items: dueToday, tone: "text-amber-700" },
    { key: "none", title: "Nothing scheduled", note: "Qualified but no next step set — the easiest leads to lose.", items: noFollowUp, tone: "text-amber-700" },
    { key: "later", title: "Scheduled", note: "Follow-up set for a future date.", items: scheduled, tone: "text-ink" },
  ].filter((g) => g.items.length > 0);

  // Per-person split so you can see where qualified work is sitting.
  const perOwner = staff
    .map((p) => ({
      id: p.id,
      name: p.full_name ?? p.email,
      total: all.filter((l) => l.assigned_to === p.id).length,
      overdue: overdue.filter((l) => l.assigned_to === p.id).length,
      today: dueToday.filter((l) => l.assigned_to === p.id).length,
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <PageHeader
        title="Qualified leads"
        subtitle={
          all.length
            ? `${all.length} ready to close · ${overdue.length} overdue · ${dueToday.length} due today`
            : "Nothing qualified yet"
        }
      />

      {all.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <BadgeCheck className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 font-medium">No qualified leads</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
            A lead lands here when its status is Qualified — set it on the lead
            page, or drag the card into a Qualified column on the Pipeline.
          </p>
          <Link href="/pipeline" className="btn-outline mt-5">Open pipeline</Link>
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

          {/* who's holding what */}
          {perOwner.length > 0 && (
            <div className="card mb-5 p-4">
              <p className="text-[13px] font-medium">Where they sit</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/qualified"
                  className={cx("chip border px-3 py-1.5 text-[13px]",
                    !sp.assigned ? "border-copper bg-copper/10 text-copper" : "border-line text-muted hover:text-ink")}
                >
                  Everyone <span className="ml-1.5 tabular-nums">{all.length}</span>
                </Link>
                {perOwner.map((o) => (
                  <Link
                    key={o.id}
                    href={`/qualified?assigned=${o.id}`}
                    className={cx("chip border px-3 py-1.5 text-[13px]",
                      sp.assigned === o.id ? "border-copper bg-copper/10 text-copper" : "border-line text-muted hover:text-ink")}
                  >
                    {o.name}
                    <span className="ml-1.5 tabular-nums">{o.total}</span>
                    {o.overdue > 0 && <span className="ml-1 text-red-600">· {o.overdue} overdue</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {stale.length > 0 && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              {stale.length} qualified lead{stale.length === 1 ? " has" : "s have"} had no
              activity for two weeks or more.
            </p>
          )}

          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className={cx("font-display text-base font-semibold", g.tone)}>{g.title}</h2>
                  <span className="chip bg-black/5 text-muted">{g.items.length}</span>
                  <span className="text-[12px] text-muted">{g.note}</span>
                </div>

                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px]">
                      <thead>
                        <tr className="border-b border-line">
                          <th className="th">Business</th>
                          <th className="th">Contact</th>
                          <th className="th">Owner</th>
                          <th className="th">Follow-up</th>
                          <th className="th">Quoted</th>
                          <th className="th">Last touched</th>
                          <th className="th text-right">Reach out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((l) => {
                          const age = daysSince(l.updated_at);
                          return (
                            <tr key={l.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                              <td className="td">
                                <Link href={`/leads/${l.id}`} className="font-medium hover:text-copper">
                                  {l.business_name}
                                </Link>
                                <div className="text-[11px] text-muted">
                                  {[l.person_name, l.city, l.category].filter(Boolean).join(" · ") || "—"}
                                </div>
                              </td>
                              <td className="td text-[13px]">
                                {l.phone ? (
                                  <a href={`tel:${l.phone}`} className="hover:text-copper">{l.phone}</a>
                                ) : (
                                  <span className="text-muted">no number</span>
                                )}
                                {!l.website && (
                                  <span className="ml-2 chip bg-amber-100 text-[11px] text-amber-800">No site</span>
                                )}
                              </td>
                              <td className={cx("td text-[13px]", l.assigned_to ? "text-muted" : "text-red-600")}>
                                {nameOf.get(l.assigned_to ?? "") ?? "Unassigned"}
                              </td>
                              <td className="td text-[13px]">
                                {l.followups_enabled && l.next_followup_at ? (
                                  <span className={l.next_followup_at < today ? "font-medium text-red-600" : ""}>
                                    {fmtDay(l.next_followup_at)}
                                  </span>
                                ) : (
                                  <Link href={`/leads/${l.id}`} className="inline-flex items-center gap-1 text-muted hover:text-copper">
                                    <CalendarPlus className="h-3.5 w-3.5" /> set one
                                  </Link>
                                )}
                              </td>
                              <td className="td text-[13px]">
                                {quoted.has(l.id) ? (
                                  <span className="chip bg-emerald-50 text-[11px] text-emerald-700">Sent</span>
                                ) : (
                                  <Link href={`/invoices/new?lead=${l.id}`} className="text-[12px] text-muted hover:text-copper">
                                    raise
                                  </Link>
                                )}
                              </td>
                              <td className={cx("td text-[12px]", age >= 14 ? "text-amber-700" : "text-muted")}>
                                {timeAgo(l.updated_at)}
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
                                  {l.website && (
                                    <a href={l.website.startsWith("http") ? l.website : `https://${l.website}`}
                                       target="_blank" rel="noopener noreferrer"
                                       className="btn-outline px-2.5 py-1.5" title="Website">
                                      <Globe className="h-4 w-4" />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
