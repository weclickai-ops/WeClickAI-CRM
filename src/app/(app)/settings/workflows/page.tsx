import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { WorkflowsClient } from "./WorkflowsClient";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const supabase = await createClient();
  const [{ data: workflows }, { data: stages }, { data: team }] = await Promise.all([
    supabase.from("workflows").select("*").order("created_at", { ascending: false }),
    supabase.from("pipeline_stages").select("id, name").order("position"),
    supabase.from("profiles").select("id, full_name, email").eq("active", true),
  ]);
  return (
    <>
      <PageHeader title="Workflows"
        subtitle="When something happens to a lead, run actions automatically — e.g. auto-assign new leads." />
      <WorkflowsClient initial={workflows ?? []} stages={stages ?? []} team={team ?? []} />
    </>
  );
}
