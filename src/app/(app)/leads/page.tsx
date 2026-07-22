import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LeadFilters } from "@/components/LeadFilters";
import { timeAgo } from "@/lib/utils";
import { Phone, Globe } from "lucide-react";
import type { Campaign, Lead, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: campaigns } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  const { data: team } = await supabase.from("profiles").select("id, full_name, email");

  let q = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);

  if (sp.status) q = q.eq("status", sp.status);
  if (sp.campaign) q = q.eq("campaign_id", sp.campaign);
  if (sp.website === "none") q = q.or("website.is.null,website.eq.");
  if (sp.website === "has") q = q.not("website", "is", null).neq("website", "");
  if (sp.q) q = q.or(`business_name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,city.ilike.%${sp.q}%`);

  const { data: leads } = await q;
  const teamMap = new Map((team ?? []).map((t: any) => [t.id, t.full_name ?? t.email]));

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${leads?.length ?? 0} shown`}
        action={<Link href="/leads/new" className="btn-outline">Add lead manually</Link>}
      />

      <LeadFilters campaigns={(campaigns ?? []) as Campaign[]} />

      <div className="card overflow-hidden">
        {(leads?.length ?? 0) === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted">
            No leads match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line">
                <th className="th">Business</th><th className="th">Phone</th>
                <th className="th">Location</th><th className="th">Website</th>
                <th className="th">Status</th><th className="th">Owner</th><th className="th">Added</th>
              </tr></thead>
              <tbody>
                {(leads as Lead[]).map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                    <td className="td font-medium">
                      <Link href={`/leads/${l.id}`} className="hover:text-copper">{l.business_name}</Link>
                      {l.category && <span className="ml-2 text-xs text-muted">{l.category.replaceAll("_", " ")}</span>}
                    </td>
                    <td className="td">
                      {l.phone
                        ? <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 text-ink hover:text-copper">
                            <Phone className="h-3.5 w-3.5" />{l.phone}
                          </a>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="td text-muted">{l.city ?? "—"}</td>
                    <td className="td">
                      {l.website
                        ? <a href={l.website} target="_blank" rel="noreferrer"
                             className="inline-flex items-center gap-1 text-muted hover:text-copper">
                            <Globe className="h-3.5 w-3.5" />site</a>
                        : <span className="chip bg-copper-soft text-copper">target</span>}
                    </td>
                    <td className="td"><StatusBadge status={l.status} /></td>
                    <td className="td text-muted">{l.assigned_to ? teamMap.get(l.assigned_to) ?? "—" : "—"}</td>
                    <td className="td text-muted">{timeAgo(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
