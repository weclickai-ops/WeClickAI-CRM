import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodePostal, scrapeNiche, onlyWithoutWebsite } from "./scraper";
import { runWorkflows } from "./workflows";

/**
 * Runs one scrape pass for a campaign. Requires a service-role (admin)
 * Supabase client so it can insert leads + log workflow runs regardless
 * of session. Returns { found, inserted }.
 */
export async function runCampaign(sb: SupabaseClient, campaignId: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const { data: campaign, error } = await sb
    .from("campaigns").select("*").eq("id", campaignId).single();
  if (error || !campaign) throw new Error("Campaign not found");

  // 1. resolve postal code → lat/lng (cache on the campaign after first run)
  let lat = campaign.center_lat, lng = campaign.center_lng;
  if (lat == null || lng == null) {
    const geo = await geocodePostal(campaign.postal_code, campaign.country, apiKey);
    if (!geo) throw new Error(`Could not locate postal code ${campaign.postal_code} (${campaign.country}). Check it's valid.`);
    lat = geo.lat; lng = geo.lng;
    await sb.from("campaigns").update({ center_lat: lat, center_lng: lng }).eq("id", campaignId);
  }

  // 2. scrape
  let leads = await scrapeNiche({
    niche: campaign.niche, keywords: campaign.keywords,
    lat, lng, radiusKm: campaign.radius_km, apiKey, maxResults: 20,
  });
  if (campaign.only_without_website) leads = onlyWithoutWebsite(leads);

  // 3. dedupe-insert (place_id is unique; upsert ignores dupes)
  let inserted = 0;
  for (const l of leads) {
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
      // fire lead.created workflows for genuinely new leads
      try { await runWorkflows(sb, "lead.created", data); } catch { /* logged inside */ }
    }
  }

  // 4. update campaign stats
  await sb.from("campaigns").update({
    last_run_at: new Date().toISOString(),
    last_run_found: inserted,
    total_found: (campaign.total_found ?? 0) + inserted,
  }).eq("id", campaignId);

  return { found: leads.length, inserted };
}
