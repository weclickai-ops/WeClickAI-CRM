import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { timeAgo } from "@/lib/utils";
import { CampaignRunButton } from "@/components/CampaignRunButton";
import { MapPin, Clock } from "lucide-react";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: campaigns } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Each campaign scrapes a niche near a postal code, on a daily schedule."
        action={<Link href="/campaigns/new" className="btn-primary">New campaign</Link>}
      />

      {(campaigns?.length ?? 0) === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-sm text-muted">No campaigns yet.</p>
          <Link href="/campaigns/new" className="btn-primary mt-4 inline-flex">Create your first campaign</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(campaigns as Campaign[]).map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                  <p className="mt-0.5 text-sm text-muted">{c.niche}{c.keywords ? ` · ${c.keywords}` : ""}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />{c.postal_code} · {c.country} · {c.radius_km}km
                </span>
                {c.run_start && c.run_end && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />{c.run_start.slice(0,5)}–{c.run_end.slice(0,5)}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <div className="text-sm">
                  <span className="font-semibold text-copper">{c.total_found}</span>
                  <span className="text-muted"> leads total</span>
                  {c.last_run_at && <span className="text-muted"> · last run {timeAgo(c.last_run_at)}</span>}
                </div>
                <CampaignRunButton campaignId={c.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
