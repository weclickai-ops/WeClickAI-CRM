import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { LeadFilters } from "@/components/LeadFilters";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { applyLeadFilters, filtersFromSearchParams } from "@/lib/leads/export";
import type { Campaign, Lead, PipelineStage, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * Filtering now goes through applyLeadFilters, shared with the export route, so
 * "export this view" and the view itself can't drift apart. It also escapes the
 * search term — the old inline filter interpolated raw `?q=` into a PostgREST
 * .or() string, so any comma or bracket in a search produced a malformed filter
 * that surfaced as "no leads match".
 *
 * The hardcoded .limit(200) is gone too: past 200 leads the header read
 * "200 shown" forever and rows 201+ were unreachable.
 */
export default async function LeadsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const filters = filtersFromSearchParams(sp);

  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const [{ data: campaigns }, { data: team }, { data: stages }, { count: totalCount }] =
    await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("pipeline_stages").select("*").order("position"),
      supabase.from("leads").select("id", { count: "exact", head: true }),
    ]);

  // head:true means the count query never ships row data.
  const { count: filteredCount } = await applyLeadFilters(
    supabase.from("leads").select("id", { count: "exact", head: true }),
    filters
  );

  const { data: leads } = await applyLeadFilters(
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1),
    filters
  );

  const teamMap = Object.fromEntries(
    (team ?? []).map((t: any) => [t.id, t.full_name ?? t.email])
  );

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${(totalCount ?? 0).toLocaleString("en-IN")} in the database`}
        action={<Link href="/leads/new" className="btn-outline">Add lead manually</Link>}
      />

      <LeadFilters campaigns={(campaigns ?? []) as Campaign[]} />

      <LeadsTable
        leads={(leads ?? []) as Lead[]}
        teamMap={teamMap}
        filters={filters}
        filteredCount={filteredCount ?? 0}
        totalCount={totalCount ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        stages={(stages ?? []) as PipelineStage[]}
        team={(team ?? []) as Pick<Profile, "id" | "full_name" | "email">[]}
      />
    </>
  );
}
