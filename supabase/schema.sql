-- =====================================================================
-- WeClick AI — Lead CRM  ·  Full database schema (Supabase / Postgres)
-- =====================================================================
-- Run this once in the Supabase SQL editor on a fresh project.
-- It is idempotent-ish: safe to re-run during development, but it will
-- DROP the app tables first so you don't accumulate half-states.
-- Order matters (foreign keys), so keep the sections in sequence.
-- =====================================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- ---------- clean slate (dev convenience) ----------
drop table if exists workflow_runs   cascade;
drop table if exists workflows       cascade;
drop table if exists invoices        cascade;
drop table if exists calls           cascade;
drop table if exists lead_notes      cascade;
drop table if exists leads           cascade;
drop table if exists campaigns       cascade;
drop table if exists custom_fields   cascade;
drop table if exists pipeline_stages cascade;
drop table if exists profiles        cascade;

drop type if exists app_role         cascade;
drop type if exists lead_status      cascade;
drop type if exists campaign_status  cascade;
drop type if exists invoice_status   cascade;

-- =====================================================================
-- ENUMS
-- =====================================================================
create type app_role        as enum ('admin', 'manager', 'agent');
create type lead_status      as enum ('new', 'contacted', 'qualified', 'won', 'lost');
create type campaign_status  as enum ('active', 'paused', 'draft');
create type invoice_status   as enum ('draft', 'sent', 'paid', 'void');

-- =====================================================================
-- PROFILES  (extends Supabase auth.users with role + display info)
-- =====================================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        app_role not null default 'agent',
  avatar_url  text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- auto-create a profile row whenever a new auth user signs up.
-- The FIRST user to ever sign up becomes 'admin'; everyone else 'agent'.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when is_first then 'admin'::app_role else 'agent'::app_role end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- helper: current user's role (used inside RLS policies)
create or replace function current_role_is(check_role app_role)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = check_role and active = true
  );
$$;

create or replace function is_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true);
$$;

-- =====================================================================
-- PIPELINE STAGES  (configurable Kanban columns)
-- =====================================================================
create table pipeline_stages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   int  not null default 0,
  color      text not null default '#B87333',   -- copper
  is_won     boolean not null default false,
  is_lost    boolean not null default false,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- CAMPAIGNS  (the lead-gen engine: niche + worldwide PIN + schedule)
-- =====================================================================
create table campaigns (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  niche          text not null,                       -- e.g. "dental clinics"
  keywords       text,                                -- extra search terms
  country        text not null default 'IN',          -- ISO-2
  postal_code    text not null,                       -- worldwide: 500034, 90210, 2000...
  radius_km      int  not null default 10,
  run_start      time,                                -- daily window start (local)
  run_end        time,                                -- daily window end
  only_without_website boolean not null default true,
  status         campaign_status not null default 'active',
  center_lat     double precision,                    -- resolved from postal_code
  center_lng     double precision,
  last_run_at    timestamptz,
  last_run_found int not null default 0,
  total_found    int not null default 0,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- =====================================================================
-- LEADS
-- =====================================================================
create table leads (
  id             uuid primary key default gen_random_uuid(),
  business_name  text not null,
  phone          text,
  email          text,
  website        text,                                -- null / '' = target (no site)
  address        text,
  category       text,
  city           text,
  country        text,
  lat            double precision,
  lng            double precision,
  place_id       text unique,                         -- dedupe key from scraper
  source         text not null default 'scraper',     -- scraper | manual | webhook
  status         lead_status not null default 'new',
  stage_id       uuid references pipeline_stages(id) on delete set null,
  campaign_id    uuid references campaigns(id) on delete set null,
  assigned_to    uuid references profiles(id) on delete set null,
  custom_data    jsonb not null default '{}'::jsonb,  -- values for custom_fields
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index leads_status_idx    on leads(status);
create index leads_stage_idx     on leads(stage_id);
create index leads_campaign_idx  on leads(campaign_id);
create index leads_assigned_idx  on leads(assigned_to);
create index leads_created_idx   on leads(created_at desc);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists leads_touch on leads;
create trigger leads_touch before update on leads
  for each row execute function touch_updated_at();

-- =====================================================================
-- LEAD NOTES
-- =====================================================================
create table lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index lead_notes_lead_idx on lead_notes(lead_id, created_at desc);

-- =====================================================================
-- CALLS  (telephony click-to-call logging)
-- =====================================================================
create table calls (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  agent_id    uuid references profiles(id) on delete set null,
  phone       text,
  outcome     text,                                   -- connected | no_answer | busy | voicemail | wrong_number
  duration_s  int default 0,
  notes       text,
  created_at  timestamptz not null default now()
);
create index calls_lead_idx on calls(lead_id, created_at desc);

-- =====================================================================
-- INVOICES  (manual mark-as-paid; Razorpay plugs in later)
-- =====================================================================
create table invoices (
  id           uuid primary key default gen_random_uuid(),
  number       text not null unique,                  -- e.g. WC-2026-0001
  lead_id      uuid references leads(id) on delete set null,
  client_name  text not null,
  client_email text,
  currency     text not null default 'INR',
  line_items   jsonb not null default '[]'::jsonb,    -- [{desc, qty, rate}]
  subtotal     numeric(12,2) not null default 0,
  tax_percent  numeric(5,2) not null default 0,
  total        numeric(12,2) not null default 0,
  status       invoice_status not null default 'draft',
  due_date     date,
  notes        text,
  issued_at    timestamptz,
  paid_at      timestamptz,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index invoices_status_idx on invoices(status);

-- =====================================================================
-- CUSTOM FIELDS  (builder — applies to leads via custom_data JSONB)
-- =====================================================================
create table custom_fields (
  id         uuid primary key default gen_random_uuid(),
  entity     text not null default 'lead',            -- lead | invoice (extendable)
  label      text not null,
  key        text not null,                           -- slug used in custom_data
  field_type text not null default 'text',            -- text|number|select|checkbox|date|url
  options    jsonb not null default '[]'::jsonb,       -- for select
  required   boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique(entity, key)
);

-- =====================================================================
-- WORKFLOWS  (rules engine: when X happens, if conditions, do actions)
-- =====================================================================
create table workflows (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  trigger_event text not null,      -- lead.created | lead.status_changed | lead.assigned | call.logged
  conditions    jsonb not null default '[]'::jsonb,   -- [{field, op, value}]
  actions       jsonb not null default '[]'::jsonb,   -- [{type, params}]
  active        boolean not null default true,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid references workflows(id) on delete cascade,
  lead_id      uuid references leads(id) on delete set null,
  status       text not null default 'success',       -- success | skipped | error
  detail       text,
  created_at   timestamptz not null default now()
);
create index workflow_runs_wf_idx on workflow_runs(workflow_id, created_at desc);

-- =====================================================================
-- SEED  (default pipeline stages so the Kanban isn't empty)
-- =====================================================================
insert into pipeline_stages (name, position, color, is_won, is_lost) values
  ('New',        0, '#8A8F98', false, false),
  ('Contacted',  1, '#B87333', false, false),
  ('Qualified',  2, '#D98A4B', false, false),
  ('Proposal',   3, '#C9752E', false, false),
  ('Won',        4, '#3E7C59', true,  false),
  ('Lost',       5, '#9B4A3B', false, true);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
-- Model: single organisation. Any active staff member can read/write
-- operational data (leads, campaigns, invoices...). Only admins manage
-- team members. Agents can see everything but this is easy to tighten
-- later (e.g. agents only see leads assigned to them).
-- =====================================================================
alter table profiles        enable row level security;
alter table pipeline_stages enable row level security;
alter table campaigns       enable row level security;
alter table leads           enable row level security;
alter table lead_notes      enable row level security;
alter table calls           enable row level security;
alter table invoices        enable row level security;
alter table custom_fields   enable row level security;
alter table workflows       enable row level security;
alter table workflow_runs   enable row level security;

-- profiles: everyone reads the team; you edit yourself; admins edit anyone
create policy profiles_read   on profiles for select using (is_staff());
create policy profiles_self   on profiles for update using (id = auth.uid());
create policy profiles_admin  on profiles for all
  using (current_role_is('admin')) with check (current_role_is('admin'));

-- generic staff-full-access policy for operational tables
create policy stages_all   on pipeline_stages for all using (is_staff()) with check (is_staff());
create policy campaigns_all on campaigns      for all using (is_staff()) with check (is_staff());
create policy leads_all    on leads           for all using (is_staff()) with check (is_staff());
create policy notes_all    on lead_notes      for all using (is_staff()) with check (is_staff());
create policy calls_all    on calls           for all using (is_staff()) with check (is_staff());
create policy invoices_all on invoices        for all using (is_staff()) with check (is_staff());
create policy cfields_all  on custom_fields   for all using (is_staff()) with check (is_staff());
create policy wf_all       on workflows       for all using (is_staff()) with check (is_staff());
create policy wfruns_all   on workflow_runs   for all using (is_staff()) with check (is_staff());

-- =====================================================================
-- NOTE ON THE SCRAPER + CRON:
-- The scheduled scraper (api/cron/campaigns) uses the SERVICE ROLE key,
-- which bypasses RLS entirely — so it can insert leads without a user
-- session. Keep that key server-side only (never NEXT_PUBLIC_).
-- =====================================================================
