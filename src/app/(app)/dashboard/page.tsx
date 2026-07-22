import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { money, timeAgo } from "@/lib/utils";
import { Users, Radar, IndianRupee, Trophy } from "lucide-react";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();

  const [{ count: totalLeads }, { count: noSiteLeads }, { count: activeCampaigns },
         { count: wonLeads }, { data: recent }, { data: paidInvoices }] =
    await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }).or("website.is.null,website.eq."),
      supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status", "won"),
      supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("invoices").select("total").eq("status", "paid"),
    ]);

  const revenue = (paidInvoices ?? []).reduce((s: number, i: any) => s + Number(i.total), 0);

  const kpis = [
    { label: "Total leads", value: totalLeads ?? 0, icon: Users, tint: "text-copper" },
    { label: "No website (targets)", value: noSiteLeads ?? 0, icon: Radar, tint: "text-copper" },
    { label: "Won", value: wonLeads ?? 0, icon: Trophy, tint: "text-emerald-600" },
    { label: "Revenue (paid)", value: money(revenue), icon: IndianRupee, tint: "text-ink" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${activeCampaigns ?? 0} active campaign${activeCampaigns === 1 ? "" : "s"} running`}
        action={<Link href="/campaigns/new" className="btn-primary">New campaign</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{k.label}</p>
              <k.icon className={`h-[18px] w-[18px] ${k.tint}`} />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Latest leads</h2>
          <Link href="/leads" className="text-sm font-medium text-copper hover:underline">View all</Link>
        </div>
        {(recent?.length ?? 0) === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            No leads yet. <Link href="/campaigns/new" className="text-copper hover:underline">Start a campaign</Link> to
            begin scraping businesses without websites.
          </div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-line">
              <th className="th">Business</th><th className="th">Location</th>
              <th className="th">Website?</th><th className="th">Status</th><th className="th">Added</th>
            </tr></thead>
            <tbody>
              {(recent as Lead[]).map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                  <td className="td font-medium">
                    <Link href={`/leads/${l.id}`} className="hover:text-copper">{l.business_name}</Link>
                  </td>
                  <td className="td text-muted">{l.city ?? l.address ?? "—"}</td>
                  <td className="td">
                    {l.website
                      ? <span className="text-muted">has site</span>
                      : <span className="chip bg-copper-soft text-copper">target</span>}
                  </td>
                  <td className="td"><StatusBadge status={l.status} /></td>
                  <td className="td text-muted">{timeAgo(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
