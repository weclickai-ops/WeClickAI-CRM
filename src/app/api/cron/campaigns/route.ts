import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCampaign } from "@/lib/runCampaign";

/**
 * Scheduled runner. Wire this to Vercel Cron (see vercel.json — hourly).
 * It scrapes every ACTIVE campaign whose daily run window contains "now".
 * Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token, or
 * pass ?secret=... for manual testing).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const provided = auth?.replace("Bearer ", "") ?? url.searchParams.get("secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: campaigns } = await admin
    .from("campaigns").select("*").eq("status", "active");

  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5); // "06:30"

  const inWindow = (c: any) => {
    if (!c.run_start || !c.run_end) return true; // no window = always eligible
    const s = c.run_start.slice(0, 5), e = c.run_end.slice(0, 5);
    return s <= hhmm && hhmm <= e;
  };

  const results: any[] = [];
  for (const c of (campaigns ?? []).filter(inWindow)) {
    try {
      const r = await runCampaign(admin, c.id);
      results.push({ campaign: c.name, ...r });
    } catch (e: any) {
      results.push({ campaign: c.name, error: e?.message });
    }
  }
  return NextResponse.json({ ran: results.length, results });
}
