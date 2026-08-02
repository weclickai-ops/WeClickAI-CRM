import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { StagesClient } from "./StagesClient";
import type { PipelineStage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const [{ data: stages }, { data: leads }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("position"),
    supabase.from("leads").select("stage_id").eq("archived", false),
  ]);

  // How many leads sit in each stage — so you know what you're deleting.
  const counts: Record<string, number> = {};
  (leads ?? []).forEach((l: any) => {
    if (l.stage_id) counts[l.stage_id] = (counts[l.stage_id] ?? 0) + 1;
  });

  return (
    <>
      <PageHeader
        title="Lead stages"
        subtitle="Your pipeline columns. Rename, reorder, add or remove them — and say what each one counts as."
      />
      <StagesClient stages={(stages ?? []) as PipelineStage[]} counts={counts} />
    </>
  );
}
