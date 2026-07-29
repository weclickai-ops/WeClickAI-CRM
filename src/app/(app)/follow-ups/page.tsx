import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDay } from "@/lib/utils";
import { Phone, CalendarClock } from "lucide-react";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: team } = await supabase.from("profiles").select("id, full_name, email");
  const teamMap = new Map((team ?? []).map((t: any) => [t.id, t.full_name ?? t.email]));

  let q = supabase.from("leads").select("*")
    .not("follow_up_date", "is", null)
    .order("follow_up_date", { ascending: true }).limit(500);
  if (sp.assigned) q = q.eq("assigned_to", sp.assigned);
  const { data: leads } = await q;
  const all = (leads ?? []) as Lead[];

  const today = startOfToday();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const day = (l: Lead) => new Date(l.follow_up_date!);

  const groups = [
    { key: "overdue",  title: "Overdue",   tone: "text-red-600", items: all.filter((l) => day(l) < today) },
    { key: "today",    title: "Today",     tone: "text-copper",  items: all.filter((l) => day(l) >= today && day(l) < tomorrow) },
    { key: "tomorrow", title: "Tomorrow",  tone: "text-ink",     items: all.filter((l) => day(l) >= tomorrow && day(l) < new Date(+tomorrow + 86400000)) },
    { key: "week",     title: "This week", tone: "text-ink",     items: all.filter((l) => day(l) >= new Date(+tomorrow + 86400000) && day(l) < weekEnd) },
    { key: "later",    title: "Later",     tone: "text-muted",   items: all.filter((l) => day(l) >= weekEnd) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader title="Follow-ups" subtitle={`${all.length} lead${all.length === 1 ? "" : "s"} scheduled`} />

      {all.length === 0 && (
        <div className="card p-8 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 font-medium">No follow-ups scheduled</p>
          <p className="mt-1 text-sm text-muted">
            Open a lead and set a follow-up date to see it here, grouped by when it's due.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
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
                        <Link href={`/leads/${l.id}`} className="font-medium hover:text-copper">{l.business_name}</Link>
                        <div className="text-xs text-muted">{[l.city, l.category].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="td"><StatusBadge status={l.status} /></td>
                      <td className="td text-sm text-muted">{teamMap.get(l.assigned_to ?? "") ?? "Unassigned"}</td>
                      <td className="td text-sm">
                        <span className={g.key === "overdue" ? "text-red-600 font-medium" : ""}>{fmtDay(l.follow_up_date)}</span>
                        {l.follow_up_note && <div className="text-xs text-muted">{l.follow_up_note}</div>}
                      </td>
                      <td className="td text-right">
                        {l.phone && (
                          <a href={`tel:${l.phone}`} className="btn-outline px-2.5 py-1.5" title="Call">
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
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
