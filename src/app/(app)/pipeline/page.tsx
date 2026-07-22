import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { KanbanBoard } from "@/components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();
  const [{ data: stages }, { data: leads }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("position"),
    supabase.from("leads").select("id, business_name, phone, city, status, stage_id, website")
      .order("created_at", { ascending: false }).limit(500),
  ]);

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Drag leads between stages. Changes save instantly." />
      <KanbanBoard stages={stages ?? []} leads={leads ?? []} />
    </>
  );
}
