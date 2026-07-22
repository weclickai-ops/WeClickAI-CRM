import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { TeamClient } from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: team } = await supabase.from("profiles").select("*").order("created_at");

  return (
    <>
      <PageHeader title="Team & roles" subtitle="Invite by having people sign up, then set their role here." />
      <TeamClient team={team ?? []} meId={user!.id} />
    </>
  );
}
