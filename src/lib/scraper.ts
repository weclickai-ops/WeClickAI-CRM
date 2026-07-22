/* =====================================================================
   The scraper — the unique engine of the CRM.
   Given a niche + a worldwide postal code + a radius, it:
     1. geocodes the postal code → lat/lng  (works for any country)
     2. runs a Google Places "Text Search" for that niche near that point
     3. for each result, pulls website + phone via Place Details
     4. returns leads, flagging the ones with NO website
   Uses the Google Places API (New) — set GOOGLE_MAPS_API_KEY.
   ===================================================================== */

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const TEXTSEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

export interface ScrapedLead {
  business_name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string;
}

/** Turn "500034" + country into a lat/lng. Works worldwide. */
export async function geocodePostal(
  postal: string,
  country: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    components: `postal_code:${postal}|country:${country}`,
    key: apiKey,
  });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return null;
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

/**
 * Run one scrape pass. Returns up to ~60 places (Google paginates in 20s;
 * the New API caps a text search page at 20, we request the max the caller wants).
 */
export async function scrapeNiche(opts: {
  niche: string;
  keywords?: string | null;
  lat: number;
  lng: number;
  radiusKm: number;
  apiKey: string;
  maxResults?: number;
}): Promise<ScrapedLead[]> {
  const { niche, keywords, lat, lng, radiusKm, apiKey } = opts;
  const query = [niche, keywords].filter(Boolean).join(" ").trim();

  const body = {
    textQuery: query,
    maxResultCount: Math.min(opts.maxResults ?? 20, 20),
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radiusKm, 50) * 1000,
      },
    },
  };

  const res = await fetch(TEXTSEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // field mask keeps cost down — only fields we store
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.primaryType",
        "places.location",
        "places.addressComponents",
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places search failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  const places: any[] = data.places ?? [];

  return places.map((p) => {
    const comps: any[] = p.addressComponents ?? [];
    const findComp = (type: string) =>
      comps.find((c) => (c.types ?? []).includes(type))?.longText ?? null;

    return {
      business_name: p.displayName?.text ?? "Unknown",
      phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      address: p.formattedAddress ?? null,
      category: p.primaryType ?? null,
      city: findComp("locality") ?? findComp("administrative_area_level_2"),
      country: findComp("country"),
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      place_id: p.id,
    } as ScrapedLead;
  });
}

/** Filter to only businesses with no website (the ones you can sell a site to). */
export function onlyWithoutWebsite(leads: ScrapedLead[]): ScrapedLead[] {
  return leads.filter((l) => !l.website || l.website.trim() === "");
}
