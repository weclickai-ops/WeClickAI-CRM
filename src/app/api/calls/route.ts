import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Optional REST endpoint for logging calls (the UI uses the client SDK directly).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { data, error } = await supabase.from("calls").insert({
    lead_id: body.lead_id, agent_id: user.id, phone: body.phone,
    outcome: body.outcome, duration_s: body.duration_s ?? 0, notes: body.notes,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
