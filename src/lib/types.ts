export type Role = "admin" | "manager" | "agent";
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
export type CampaignStatus = "active" | "paused" | "draft";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface Profile {
  id: string; email: string; full_name: string | null;
  role: Role; avatar_url: string | null; active: boolean; created_at: string;
}
export interface PipelineStage {
  id: string; name: string; position: number; color: string;
  is_won: boolean; is_lost: boolean;
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
}
export interface CustomField {
  id: string; entity: string; label: string; key: string;
  field_type: "text" | "number" | "select" | "checkbox" | "date" | "url";
  options: string[]; required: boolean; position: number;
}
export interface Invoice {
  id: string; number: string; lead_id: string | null; client_name: string;
  client_email: string | null; currency: string;
  line_items: { desc: string; qty: number; rate: number }[];
  subtotal: number; tax_percent: number; total: number;
  status: InvoiceStatus; due_date: string | null; notes: string | null;
  issued_at: string | null; paid_at: string | null; created_at: string;
}
export interface Workflow {
  id: string; name: string; trigger_event: string;
  conditions: { field: string; op: string; value: string }[];
  actions: { type: string; params: Record<string, string> }[];
  active: boolean; created_at: string;
}
