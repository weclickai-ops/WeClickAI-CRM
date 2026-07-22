import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeadDetailClient } from "./LeadDetailClient";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) notFound();

  const [{ data: notes }, { data: calls }, { data: team }, { data: stages }, { data: fields }] =
    await Promise.all([
      supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("calls").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email").eq("active", true),
      supabase.from("pipeline_stages").select("*").order("position"),
      supabase.from("custom_fields").select("*").eq("entity", "lead").order("position"),
    ]);

  return (
    <LeadDetailClient
      lead={lead}
      initialNotes={notes ?? []}
      initialCalls={calls ?? []}
      team={team ?? []}
      stages={stages ?? []}
      fields={fields ?? []}
    />
  );
}
