import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodePostal, scrapeNiche, onlyWithoutWebsite, type ScrapedLead } from "./scraper";
import { runWorkflows } from "./workflows";

/**
 * Runs one scrape pass for a campaign. `postal_code` may hold MULTIPLE codes
 * (comma or newline separated) — each is geocoded and scraped separately,
 * then merged and de-duplicated by place_id.
 */
export async function runCampaign(sb: SupabaseClient, campaignId: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const { data: campaign, error } = await sb
    .from("campaigns").select("*").eq("id", campaignId).single();
  if (error || !campaign) throw new Error("Campaign not found");

  const codes: string[] = String(campaign.postal_code)
    .split(/[,\n]/).map((c: string) => c.trim()).filter(Boolean);
  if (codes.length === 0) throw new Error("No postal code set on this campaign.");

  let all: ScrapedLead[] = [];
  const failed: string[] = [];
  let firstCenter: { lat: number; lng: number } | null = null;

  for (const code of codes) {
    const geo = await geocodePostal(code, campaign.country, apiKey);
    if (!geo) { failed.push(code); continue; }
    if (!firstCenter) firstCenter = geo;
    const leads = await scrapeNiche({
      niche: campaign.niche, keywords: campaign.keywords,
      lat: geo.lat, lng: geo.lng, radiusKm: campaign.radius_km, apiKey, maxResults: 20,
    });
    all.push(...leads);
  }

  if (!firstCenter) {
    throw new Error(`Could not locate any of these postal codes (${codes.join(", ")}) in ${campaign.country}. Check they're valid.`);
  }

  await sb.from("campaigns").update({ center_lat: firstCenter.lat, center_lng: firstCenter.lng }).eq("id", campaignId);

  if (campaign.only_without_website) all = onlyWithoutWebsite(all);
  const seen = new Set<string>();
  all = all.filter((l) => (l.place_id && !seen.has(l.place_id)) ? (seen.add(l.place_id), true) : false);

  let inserted = 0;
  for (const l of all) {
    const row = {
      business_name: l.business_name, phone: l.phone, website: l.website,
      address: l.address, category: l.category, city: l.city, country: l.country,
      lat: l.lat, lng: l.lng, place_id: l.place_id,
      source: "scraper", campaign_id: campaignId,
    };
    const { data, error: insErr } = await sb
      .from("leads").upsert(row, { onConflict: "place_id", ignoreDuplicates: true })
      .select().maybeSingle();

    if (!insErr && data) {
      inserted++;
      try { await runWorkflows(sb, "lead.created", data); } catch { /* logged inside */ }
    }
  }

  await sb.from("campaigns").update({
    last_run_at: new Date().toISOString(),
    last_run_found: inserted,
    total_found: (campaign.total_found ?? 0) + inserted,
  }).eq("id", campaignId);

  return { found: all.length, inserted, areas: codes.length, failedAreas: failed };
}
