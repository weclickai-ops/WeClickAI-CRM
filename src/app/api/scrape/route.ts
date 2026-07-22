import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCampaign } from "@/lib/runCampaign";

// Manual "Run once now" — requires a logged-in staff session.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { campaign_id } = await req.json().catch(() => ({}));
  if (!campaign_id) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });

  try {
    // service-role client to insert leads + run workflows
    const admin = createAdminClient();
    const result = await runCampaign(admin, campaign_id);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Scrape failed" }, { status: 500 });
  }
}
