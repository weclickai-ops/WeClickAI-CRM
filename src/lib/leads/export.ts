import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lead export — filters, columns and CSV, in one file with no dependencies.
 *
 * Column names here match the real `leads` table. If you add a column to the
 * database, add it to LEAD_COLUMNS and it appears in every export.
 */

export type LeadRow = Record<string, any>;

export interface LeadColumn {
  key: string;
  label: string;
  get: (l: LeadRow) => unknown;
}

export const LEAD_COLUMNS: LeadColumn[] = [
  { key: "business_name", label: "Business", get: (l) => l.business_name },
  { key: "person_name", label: "Person", get: (l) => l.person_name },
  { key: "category", label: "Category", get: (l) => (l.category ? String(l.category).replaceAll("_", " ") : "") },
  { key: "phone", label: "Phone", get: (l) => l.phone },
  { key: "whatsapp", label: "WhatsApp", get: (l) => l.whatsapp },
  { key: "email", label: "Email", get: (l) => l.email },
  { key: "website", label: "Website", get: (l) => l.website },
  { key: "instagram", label: "Instagram", get: (l) => l.instagram },
  { key: "linkedin", label: "LinkedIn", get: (l) => l.linkedin },
  // Derived, not a column: the app's own definition of a sales target.
  { key: "is_target", label: "Target (no site)", get: (l) => (!l.website || String(l.website).trim() === "" ? "Yes" : "No") },
  { key: "address", label: "Address", get: (l) => l.address },
  { key: "city", label: "City", get: (l) => l.city },
  { key: "country", label: "Country", get: (l) => l.country },
  { key: "status", label: "Status", get: (l) => l.status },
  { key: "stage", label: "Pipeline stage", get: (l) => l.stage?.name ?? "" },
  { key: "assigned_to", label: "Owner", get: (l) => l.assignee?.full_name ?? l.assignee?.email ?? "" },
  { key: "campaign", label: "Campaign", get: (l) => l.campaign?.name ?? "" },
  { key: "source", label: "Source", get: (l) => l.source },
  { key: "next_followup_at", label: "Next follow-up", get: (l) => l.next_followup_at ?? "" },
  { key: "place_id", label: "Google place ID", get: (l) => l.place_id },
  { key: "created_at", label: "Added", get: (l) => fmtDate(l.created_at) },
  { key: "updated_at", label: "Last updated", get: (l) => fmtDate(l.updated_at) },
];

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
});

function fmtDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? "" : DATE_FMT.format(d);
}

/** Only real columns, plus three joins for the human-readable names. */
export function selectClause(): string {
  return [
    "id", "business_name", "person_name", "phone", "whatsapp", "email", "website",
    "instagram", "linkedin", "address", "category", "city", "country", "place_id",
    "source", "status", "stage_id", "campaign_id", "assigned_to",
    "next_followup_at", "created_at", "updated_at",
    "assignee:profiles!leads_assigned_to_fkey(full_name,email)",
    "campaign:campaigns!leads_campaign_id_fkey(name)",
    "stage:pipeline_stages!leads_stage_id_fkey(name)",
  ].join(",");
}

// ---------------------------------------------------------------------------
// Filters — the same shape the leads page puts in the URL, so "export this
// view" and the view itself can never drift apart.
// ---------------------------------------------------------------------------

export interface LeadFilters {
  q?: string;
  status?: string;
  website?: "none" | "has" | "";
  campaign?: string;
  /** ISO date, inclusive */
  from?: string;
  /** ISO date, inclusive — the whole of that day counts */
  to?: string;
}

export function filtersFromSearchParams(sp: Record<string, string>): LeadFilters {
  return {
    q: sp.q,
    status: sp.status,
    website: sp.website as LeadFilters["website"],
    campaign: sp.campaign,
    from: sp.from,
    to: sp.to,
  };
}

/**
 * PostgREST's `or=` filter is a comma-and-bracket delimited mini-language, so
 * raw user text has to be stripped before it goes in. Without this, searching
 * "Dr. Reddy, Banjara Hills" builds a malformed filter — a 400 that the UI
 * shows as "no leads match" — and a crafted query could inject extra conditions.
 */
function escapeForOr(term: string): string {
  return term.trim().replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim();
}

export function applyLeadFilters(query: any, f: LeadFilters = {}) {
  const term = f.q ? escapeForOr(f.q) : "";
  if (term) {
    query = query.or(
      `business_name.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%,email.ilike.%${term}%`
    );
  }
  if (f.status) query = query.eq("status", f.status);

  // There is no has_website column — this is the same test the app already uses.
  if (f.website === "none") query = query.or("website.is.null,website.eq.");
  if (f.website === "has") query = query.not("website", "is", null).neq("website", "");

  if (f.campaign) query = query.eq("campaign_id", f.campaign);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00`);
  // `to` is inclusive: a lead added at 4pm on the end date should be included.
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59.999`);

  return query;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const PAGE = 1000;

/**
 * PostgREST returns at most 1000 rows per request however many match, so any
 * export that skips this paginator silently hands over a truncated file.
 */
export async function fetchLeadsForExport(
  supabase: SupabaseClient,
  opts: { ids?: string[]; filters?: LeadFilters; limit: number }
): Promise<LeadRow[]> {
  const out: LeadRow[] = [];
  let from = 0;

  while (out.length < opts.limit) {
    let q = supabase
      .from("leads")
      .select(selectClause())
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })          // stable paging on tied timestamps
      .range(from, from + PAGE - 1);

    if (opts.ids?.length) q = q.in("id", opts.ids.slice(0, 10_000));
    else q = applyLeadFilters(q, opts.filters);

    const { data, error } = await q;
    if (error) throw new Error(`Couldn't read leads: ${error.message}`);
    if (!data?.length) break;

    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return out.slice(0, opts.limit);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Excel on Windows needs a BOM or it mangles non-ASCII business names. */
const BOM = "\uFEFF";

/**
 * A cell starting with = + - @ is run as a formula when the file opens.
 * A leading tab neutralises it and stays invisible in the cell.
 */
function cell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `\t${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(leads: LeadRow[], columns: LeadColumn[] = LEAD_COLUMNS): string {
  const lines = [columns.map((c) => cell(c.label)).join(",")];
  for (const lead of leads) {
    lines.push(columns.map((c) => cell(c.get(lead))).join(","));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Shown in the toast so a download explains itself. */
export function describeSelection(ids: string[] | undefined, f: LeadFilters = {}): string {
  if (ids?.length) return `${ids.length} selected lead${ids.length === 1 ? "" : "s"}`;
  const bits: string[] = [];
  if (f.q) bits.push(`search "${f.q}"`);
  if (f.status) bits.push(f.status);
  if (f.website === "none") bits.push("no website");
  if (f.website === "has") bits.push("has website");
  if (f.from || f.to) bits.push(`added ${f.from ?? "any"} to ${f.to ?? "today"}`);
  return bits.length ? bits.join(" · ") : "all leads";
}
