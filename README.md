# WeClick AI — Lead CRM

A lead-generation CRM for a web-development agency. Run a **niche campaign**
against any **postal code in the world**, and it scrapes local businesses,
flags the ones with **no website** (the ones you can sell a site to), and drops
them into a pipeline you can work — call, note, move through stages, and invoice.

Built with **Next.js 15 (App Router) + Supabase (Postgres) + Tailwind**.
Deploys **GitHub → Vercel**, same path as the 18startup repo.

---

## What's inside

| Feature | Status |
|---|---|
| Team login + roles (admin / manager / agent) | ✅ Supabase Auth + RLS |
| Scraper → real database (Google Places, worldwide PIN) | ✅ `/api/scrape` + hourly cron |
| Leads list with filters (status, website, campaign, search) | ✅ |
| Lead page: notes, status, stage, assignment, custom fields | ✅ |
| Telephony click-to-call + call logging | ✅ `tel:` + call log modal |
| Kanban pipeline (drag & drop) | ✅ |
| Invoicing (manual mark-as-paid; Razorpay later) | ✅ printable |
| Custom fields builder | ✅ |
| Workflow rules engine (trigger → conditions → actions) | ✅ |
| WhatsApp, FB/IndiaMART webhooks, Razorpay processing | ⏭ deliberately skipped for now |

---

## 1. Create the database

1. Make a Supabase project (or use your existing one).
2. Open **SQL Editor** → paste the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.
   This creates every table, the auth trigger, seed pipeline stages, and RLS.
3. **The first person who signs up becomes `admin` automatically.** Everyone
   after that is an `agent` until an admin promotes them under *Settings → Team*.

## 2. Get a Google Places key (the scraper)

1. Google Cloud Console → enable **Places API (New)** and **Geocoding API**.
2. Create an API key. Restrict it to those two APIs.
3. This is billable — keep the daily run window tight (the cron respects it).

## 3. Environment variables

Copy `.env.example` → `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...          # Supabase → Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # anon public key
SUPABASE_SERVICE_ROLE_KEY=...         # service_role key — SERVER ONLY, never NEXT_PUBLIC
GOOGLE_MAPS_API_KEY=...
CRON_SECRET=<a long random string>
```

> The **service role key bypasses RLS** — it's what lets the scraper insert
> leads without a logged-in user. Keep it server-side only.

## 4. Run locally

```bash
npm install
npm run dev
# http://localhost:3000  → sign up (first user = admin)
```

## 5. Deploy to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add the same env vars in **Vercel → Project → Settings → Environment Variables**.
4. Deploy. `vercel.json` already registers the hourly cron
   (`/api/cron/campaigns`) — Vercel Cron sends the `CRON_SECRET` as a Bearer
   token, which the route checks.

---

## How the scraper timing works

- A campaign has a **daily run window** (e.g. 06:00–07:00).
- The Vercel cron fires **every hour**; it only scrapes campaigns whose window
  contains the current time — so cost stays predictable.
- **Run once now** (on each campaign, and the checkbox on the new-campaign form)
  triggers `/api/scrape` immediately, so you can test without waiting.
- One run pulls up to ~20 places per pass (Google's page size). A wide radius
  may take a few runs to fully cover an area; a single PIN at 10 km usually
  finishes in one pass.
- `place_id` is a unique key, so re-runs never create duplicate leads.

## Branding

All colours live as CSS variables at the top of
[`src/app/globals.css`](./src/app/globals.css) — charcoal + copper placeholders.
Swap them for your exact logo hex. To use your real logo: drop the file into
`public/logo.svg` and follow the note in
[`src/components/Logo.tsx`](./src/components/Logo.tsx).

## Plugging in the deferred pieces later

- **Razorpay**: add a "Pay now" link on the invoice using Razorpay Payment
  Links, and flip `status` to `paid` from a Razorpay webhook. The `invoices`
  table already has everything it needs.
- **WhatsApp**: add a "Message on WhatsApp" button on the lead page
  (`https://wa.me/<phone>`), or wire Twilio/Gupshup as a workflow action.
- **Webhooks (FB / IndiaMART)**: add `/api/webhooks/<source>` that inserts into
  `leads` with `source = 'webhook'` via the admin client.

## Project map

```
supabase/schema.sql          — full DB + RLS + seed
src/lib/scraper.ts           — Google Places geocode + text search
src/lib/runCampaign.ts       — one scrape pass: geocode→scrape→dedupe→workflows
src/lib/workflows.ts         — rules engine
src/app/api/scrape           — manual "run now"
src/app/api/cron/campaigns   — scheduled runner (hourly)
src/app/(app)/*              — the CRM UI (dashboard, leads, pipeline, campaigns, invoices, settings)
```
