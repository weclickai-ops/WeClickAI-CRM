export type Role = "admin" | "manager" | "agent";
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
export type CampaignStatus = "active" | "paused" | "draft";
export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "void" | "written_off";

export interface Profile {
  id: string; email: string; full_name: string | null;
  role: Role; avatar_url: string | null; active: boolean; created_at: string;
}

export type StageGroup = "todo" | "in_progress" | "complete";

export interface PipelineStage {
  id: string; name: string; position: number; color: string;
  is_won: boolean; is_lost: boolean;
  stage_group: StageGroup;
  maps_to_status: LeadStatus;
  is_default: boolean;
}

export interface Campaign {
  id: string; name: string; niche: string; keywords: string | null;
  country: string; postal_code: string; radius_km: number;
  run_start: string | null; run_end: string | null;
  only_without_website: boolean; status: CampaignStatus;
  center_lat: number | null; center_lng: number | null;
  last_run_at: string | null; last_run_found: number; total_found: number;
  created_at: string;
}

export interface Lead {
  id: string; business_name: string; phone: string | null; email: string | null;
  website: string | null; address: string | null; category: string | null;
  city: string | null; country: string | null; lat: number | null; lng: number | null;
  place_id: string | null; source: string; status: LeadStatus;
  stage_id: string | null; campaign_id: string | null; assigned_to: string | null;
  custom_data: Record<string, unknown>; created_at: string; updated_at: string;

  // the Notion model
  person_name: string | null;
  bio: string | null;
  instagram: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  facebook: string | null;
  x_handle: string | null;
  youtube: string | null;
  logo_url: string | null;
  archived: boolean;

  // follow-up engine (recurring — drives /today)
  followups_enabled: boolean;
  followup_interval_days: number;
  next_followup_at: string | null;
  last_followed_up_at: string | null;

  // one-shot follow-up (drives /follow-ups and /qualified)
  follow_up_date: string | null;
  follow_up_note: string | null;
}

/** From the lead_checks view — computed, never stored, so it can't go stale. */
export interface LeadChecks {
  id: string;
  needs_name: boolean;
  needs_email: boolean;
  needs_phone: boolean;
  followup_overdue: boolean;
  days_overdue: number | null;
}

export type ScriptKind = "call" | "email" | "whatsapp" | "dm";

export interface LeadScript {
  id: string; name: string; kind: ScriptKind; version: number;
  body: string; active: boolean; created_at: string; updated_at: string;
}

export interface CustomField {
  id: string; entity: string; label: string; key: string;
  field_type: "text" | "number" | "select" | "checkbox" | "date" | "url";
  options: string[]; required: boolean; position: number;
}

export interface CompanySettings {
  id: number;
  legal_name: string; tagline: string | null; address: string | null;
  gstin: string | null; pan: string | null; email: string | null;
  phone: string | null; logo_url: string | null;
  bank_name: string | null; account_name: string | null;
  account_number: string | null; ifsc: string | null;
  swift: string | null; upi: string | null;
  invoice_prefix: string; next_number: number; number_padding: number;
  default_terms: string | null; base_currency: string;
}

export interface Invoice {
  id: string; number: string; lead_id: string | null; client_name: string;
  client_email: string | null; client_phone: string | null;
  client_company: string | null; client_address: string | null;
  issued_on: string | null; currency: string;
  line_items: { desc: string; qty: number; rate: number }[];
  subtotal: number; tax_percent: number; total: number;
  status: InvoiceStatus; amount_paid: number; due_date: string | null; notes: string | null;
  issued_at: string | null; paid_at: string | null; created_at: string;
}

export interface Workflow {
  id: string; name: string; trigger_event: string;
  conditions: { field: string; op: string; value: string }[];
  actions: { type: string; params: Record<string, string> }[];
  active: boolean; created_at: string;
}
