import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDay, timeAgo } from "@/lib/utils";
import { Phone, Globe, CalendarPlus } from "lucide-react";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QualifiedPage({ searchParams }: { searchParams: Promise<Record<string,string>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { data: team } = await supabase.from("profiles").select("id, full_name, email");
  const teamMap = new Map((team ?? []).map((t: any) => [t.id, t.full_name ?? t.email]));

  let q = supabase.from("leads").select("*").eq("status", "qualified")
    .order("updated_at", { ascending: false }).limit(300);
  if (sp.assigned) q = q.eq("assigned_to", sp.assigned);
  if (sp.q) q = q.or(`business_name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,city.ilike.%${sp.q}%`);
  const { data: leads } = await q;
  const all = (leads ?? []) as Lead[];

  return (
    <>
      <PageHeader title="Qualified leads"
        subtitle={`${all.length} lead${all.length === 1 ? "" : "s"} ready to close`} />

      {all.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium">No qualified leads yet</p>
          <p className="mt-1 text-sm text-muted">
            Mark a lead as <strong>Qualified</strong> from its detail page and it appears here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-line">
              <th className="th">Business</th><th className="th">Contact</th>
              <th className="th">Owner</th><th className="th">Follow-up</th>
              <th className="th">Qualified</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {all.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                  <td className="td">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:text-copper">{l.business_name}</Link>
                    <div className="text-xs text-muted">{[l.city, l.category].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="td text-sm">
                    {l.phone ? <a href={`tel:${l.phone}`} className="hover:text-copper">{l.phone}</a> : <span className="text-muted">—</span>}
                    {(!l.website || l.website === "") && <span className="ml-2 chip bg-amber-100 text-amber-800">No site</span>}
                  </td>
                  <td className="td text-sm text-muted">{teamMap.get(l.assigned_to ?? "") ?? "Unassigned"}</td>
                  <td className="td text-sm">
                    {l.followups_enabled && l.next_followup_at
                      ? <span className={l.next_followup_at < todayYmd ? "font-medium text-red-600" : ""}>{fmtDay(l.next_followup_at)}</span>
                      : <Link href={`/leads/${l.id}`} className="inline-flex items-center gap-1 text-muted hover:text-copper">
                          <CalendarPlus className="h-3.5 w-3.5" /> set
                        </Link>}
                  </td>
                  <td className="td text-sm text-muted">{timeAgo(l.updated_at)}</td>
                  <td className="td text-right">
                    {l.phone && <a href={`tel:${l.phone}`} className="btn-outline px-2.5 py-1.5"><Phone className="h-4 w-4" /></a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
