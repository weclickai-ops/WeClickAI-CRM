import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FollowUpDone } from "@/components/leads/FollowUpDone";
import { fmtDay, timeAgo } from "@/lib/utils";
import { Phone, CalendarClock } from "lucide-react";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Local YYYY-MM-DD — next_followup_at is a plain date, so compare as strings. */
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
  const { data: team } = await supabase.from("profiles").select("id, full_name, email");
  const teamMap = new Map((team ?? []).map((t: any) => [t.id, t.full_name ?? t.email]));

  let q = supabase
    .from("leads")
    .select("*")
    .eq("followups_enabled", true)
    .eq("archived", false)
    .not("next_followup_at", "is", null)
    .order("next_followup_at", { ascending: true })
    .limit(500);
  if (sp.assigned) q = q.eq("assigned_to", sp.assigned);
  const { data: leads } = await q;
  const all = (leads ?? []) as Lead[];

  const today = ymd(new Date());
  const tomorrow = plusDays(1);
  const weekEnd = plusDays(7);
  const on = (l: Lead) => l.next_followup_at!;

  const groups = [
    { key: "overdue",  title: "Overdue",   tone: "text-red-600", items: all.filter((l) => on(l) < today) },
    { key: "today",    title: "Today",     tone: "text-copper",  items: all.filter((l) => on(l) === today) },
    { key: "tomorrow", title: "Tomorrow",  tone: "text-ink",     items: all.filter((l) => on(l) === tomorrow) },
    { key: "week",     title: "This week", tone: "text-ink",     items: all.filter((l) => on(l) > tomorrow && on(l) <= weekEnd) },
    { key: "later",    title: "Later",     tone: "text-muted",   items: all.filter((l) => on(l) > weekEnd) },
  ];

  const overdue = groups[0].items.length;
  const dueToday = groups[1].items.length;
  const visible = groups.filter((g) => g.items.length > 0);

  const subtitle = all.length
    ? [
        `${all.length} scheduled`,
        overdue ? `${overdue} overdue` : null,
        dueToday ? `${dueToday} due today` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "0 leads scheduled";

  return (
    <>
      <PageHeader title="Follow-ups" subtitle={subtitle} />

      {all.length === 0 && (
        <div className="card p-8 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 font-medium">No follow-ups scheduled</p>
          <p className="mt-1 text-sm text-muted">
            Open a lead and tap Today, Tomorrow, +3 days or Next week in the
            Follow-up card. It shows up here, grouped by when it&rsquo;s due.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {visible.map((g) => (
          <div key={g.key}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className={`font-display text-base font-semibold ${g.tone}`}>{g.title}</h2>
              <span className="chip bg-black/5 text-muted">{g.items.length}</span>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full">
                <tbody>
                  {g.items.map((l) => (
                    <tr key={l.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                      <td className="td">
                        <Link href={`/leads/${l.id}`} className="font-medium hover:text-copper">
                          {l.business_name}
                        </Link>
                        <div className="text-xs text-muted">
                          {[l.person_name, l.city, l.category].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="td"><StatusBadge status={l.status} /></td>
                      <td className="td text-sm text-muted">
                        {teamMap.get(l.assigned_to ?? "") ?? "Unassigned"}
                      </td>
                      <td className="td text-sm">
                        <span className={g.key === "overdue" ? "font-medium text-red-600" : ""}>
                          {fmtDay(l.next_followup_at)}
                        </span>
                        <div className="text-xs text-muted">
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
                          <FollowUpDone leadId={l.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
