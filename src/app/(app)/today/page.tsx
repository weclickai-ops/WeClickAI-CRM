import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { TodayClient } from "./TodayClient";
import type { Lead, PipelineStage } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Today — the call list.
 *
 * Everything with a follow-up due on or before today, oldest first, so the most
 * neglected lead is the one you see. This is the screen that turns a list of
 * leads into a list of calls.
 */
export default async function TodayPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: due }, { data: upcoming }, { data: stages }, { data: team }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .eq("followups_enabled", true)
        .eq("archived", false)
        .lte("next_followup_at", today)
        .order("next_followup_at", { ascending: true })
        .limit(200),
      supabase
        .from("leads")
        .select("*")
        .eq("followups_enabled", true)
        .eq("archived", false)
        .gt("next_followup_at", today)
        .order("next_followup_at", { ascending: true })
        .limit(50),
      supabase.from("pipeline_stages").select("*").order("position"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const stageMap = Object.fromEntries(
    ((stages ?? []) as PipelineStage[]).map((s) => [s.id, s])
  );
  const teamMap = Object.fromEntries(
    (team ?? []).map((t: any) => [t.id, t.full_name ?? t.email])
  );

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={
          (due?.length ?? 0) === 0
            ? "Nothing due — you're clear"
            : `${due!.length} to follow up`
        }
      />
      <TodayClient
        due={(due ?? []) as Lead[]}
        upcoming={(upcoming ?? []) as Lead[]}
        stageMap={stageMap}
        teamMap={teamMap}
        today={today}
      />
    </>
  );
}
