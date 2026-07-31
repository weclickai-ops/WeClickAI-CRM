"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "../../PageHeader";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { SERVICES } from "@/lib/delivery";
import type { Profile } from "@/lib/types";
import { Loader2, Check, Search, Plus, X, Building2, Briefcase } from "lucide-react";

const INDUSTRIES = [
  "Healthcare", "Real estate", "Education", "Retail", "Food & beverage",
  "Manufacturing", "Professional services", "Fitness & wellness",
  "Travel & hospitality", "Technology", "Automotive", "Other",
];

type LeadHit = {
  id: string; business_name: string; person_name: string | null;
  email: string | null; phone: string | null; website: string | null;
  address: string | null; city: string | null; category: string | null;
  source: string; assigned_to: string | null;
};

/**
 * Defined at module scope on purpose. When a component is declared inside
 * another component's body, React sees a new component type on every render,
 * unmounts the old input and mounts a fresh one — which throws away focus
 * after each keystroke.
 */
function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewClientPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();

  const [team, setTeam] = useState<Profile[]>([]);
  const [leadId, setLeadId] = useState<string | null>(params.get("lead"));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [c, setC] = useState({
    company_name: "", contact_name: "", designation: "",
    email: "", phone: "", whatsapp: "", website: "",
    address: "", city: "", industry: "", source: "",
    logo_url: null as string | null,
    client_since: ymd(new Date()),
    account_manager: "",
    notes_internal: "",
  });

  const [addProject, setAddProject] = useState(true);
  const [p, setP] = useState({
    name: "", service: SERVICES[0], priority: "medium",
    start_date: ymd(new Date()),
    delivery_date: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return ymd(d); })(),
    budget: "", owner: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("active", true)
      .then(({ data }) => setTeam((data ?? []) as Profile[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!leadId) return;
    supabase.from("leads")
      .select("id, business_name, person_name, email, phone, website, address, city, category, source, assigned_to")
      .eq("id", leadId).single()
      .then(({ data }) => data && fill(data as LeadHit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from("leads")
        .select("id, business_name, person_name, email, phone, website, address, city, category, source, assigned_to")
        .or(`business_name.ilike.%${q}%,person_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(6);
      setHits((data ?? []) as LeadHit[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function fill(l: LeadHit) {
    setLeadId(l.id);
    setC((prev) => ({
      ...prev,
      company_name: l.business_name,
      contact_name: l.person_name ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      whatsapp: l.phone ?? "",
      website: l.website ?? "",
      address: l.address ?? "",
      city: l.city ?? "",
      industry: l.category ?? "",
      source: l.source ?? "",
      account_manager: l.assigned_to ?? prev.account_manager,
    }));
    setQuery(""); setHits([]);
  }

  async function save() {
    if (!c.company_name.trim()) { setError("Company name is required."); return; }
    if (addProject && !p.name.trim() && !p.service) { setError("Give the project a name."); return; }

    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: client, error: cErr } = await supabase.from("clients").insert({
        lead_id: leadId,
        company_name: c.company_name.trim(),
        contact_name: c.contact_name.trim() || null,
        designation: c.designation.trim() || null,
        email: c.email.trim() || null,
        phone: c.phone.trim() || null,
        whatsapp: c.whatsapp.trim() || null,
        website: c.website.trim() || null,
        address: c.address.trim() || null,
        city: c.city.trim() || null,
        industry: c.industry || null,
        source: c.source || null,
        logo_url: c.logo_url,
        client_since: c.client_since,
        account_manager: c.account_manager || null,
        notes_internal: c.notes_internal.trim() || null,
        status: "active",
      }).select().single();
      if (cErr) throw cErr;

      if (addProject) {
        const { error: pErr } = await supabase.from("projects").insert({
          client_id: client.id,
          name: p.name.trim() || p.service,
          service: p.service,
          priority: p.priority,
          status: "planning",
          start_date: p.start_date || null,
          delivery_date: p.delivery_date || null,
          budget: Number(p.budget) || 0,
          owner: p.owner || c.account_manager || null,
        });
        if (pErr) throw pErr;
      }

      await supabase.from("client_activity").insert({
        client_id: client.id,
        kind: "status",
        summary: `${c.company_name.trim()} added as a client`,
        actor: user?.id ?? null,
      });

      router.push(`/clients/${client.id}`);
      router.refresh();
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? "Could not save the client.");
    }
  }


  return (
    <>
      <PageHeader title="Add client" subtitle="Someone you're delivering for — separate from your leads." />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_19rem]">
        <div className="space-y-5">
          {/* from a lead */}
          {!leadId && (
            <div className="card p-5">
              <p className="text-[14px] font-medium">Came from a lead?</p>
              <p className="mt-0.5 text-[13px] text-muted">
                Search and we&rsquo;ll copy the details across, and keep the two linked.
              </p>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-9" placeholder="Search leads…"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
                {hits.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                    {hits.map((h) => (
                      <button key={h.id} onClick={() => fill(h)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/[0.03]">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{h.business_name}</span>
                          <span className="block truncate text-xs text-muted">
                            {[h.person_name, h.email].filter(Boolean).join(" · ") || "no contact details"}
                          </span>
                        </span>
                        <Plus className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {leadId && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <Check className="h-4 w-4" />
              <span className="flex-1">Linked to a lead — its history stays reachable from the workspace.</span>
              <button className="btn-ghost px-1.5 py-1" onClick={() => setLeadId(null)} title="Unlink">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* company */}
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted" />
              <p className="text-[14px] font-medium">Company</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Company name *" placeholder="Rakshita Hospital"  value={c.company_name} onChange={(v) => setC({ ...c, company_name: v })} />
              </div>
              <Field label="Contact name"  value={c.contact_name} onChange={(v) => setC({ ...c, contact_name: v })} />
              <Field label="Designation" placeholder="Director"  value={c.designation} onChange={(v) => setC({ ...c, designation: v })} />
              <Field label="Email" type="email"  value={c.email} onChange={(v) => setC({ ...c, email: v })} />
              <Field label="Phone"  value={c.phone} onChange={(v) => setC({ ...c, phone: v })} />
              <Field label="WhatsApp"  value={c.whatsapp} onChange={(v) => setC({ ...c, whatsapp: v })} />
              <Field label="Website" placeholder="example.com"  value={c.website} onChange={(v) => setC({ ...c, website: v })} />
              <div>
                <label className="label">Industry</label>
                <select className="input" value={c.industry} onChange={(e) => setC({ ...c, industry: e.target.value })}>
                  <option value="">Not set</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <Field label="City"  value={c.city} onChange={(v) => setC({ ...c, city: v })} />
              <div className="sm:col-span-2">
                <Field label="Address"  value={c.address} onChange={(v) => setC({ ...c, address: v })} />
              </div>
              <div className="sm:col-span-2">
                <ImageUpload
                  label="Company logo"
                  value={c.logo_url}
                  onChange={(url) => setC({ ...c, logo_url: url })}
                  folder="client-logos"
                  boxClass="h-20"
                  hint="Shows in the client list and workspace. Initials are used if you skip it."
                />
              </div>
            </div>
          </div>

          {/* first project */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted" />
                <p className="text-[14px] font-medium">First project</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                <input type="checkbox" checked={addProject} onChange={(e) => setAddProject(e.target.checked)} />
                Create one now
              </label>
            </div>

            {addProject ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Service</label>
                  <select className="input" value={p.service} onChange={(e) => setP({ ...p, service: e.target.value })}>
                    {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Project name</label>
                  <input className="input" placeholder={p.service} value={p.name}
                         onChange={(e) => setP({ ...p, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Start date</label>
                  <input type="date" className="input" value={p.start_date}
                         onChange={(e) => setP({ ...p, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Delivery date</label>
                  <input type="date" className="input" value={p.delivery_date}
                         onChange={(e) => setP({ ...p, delivery_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Budget</label>
                  <input className="input" inputMode="decimal" placeholder="50000" value={p.budget}
                         onChange={(e) => setP({ ...p, budget: e.target.value })} />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={p.priority} onChange={(e) => setP({ ...p, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Project owner</label>
                  <select className="input" value={p.owner} onChange={(e) => setP({ ...p, owner: e.target.value })}>
                    <option value="">Same as account manager</option>
                    {team.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted">
                You can add projects from the workspace whenever you&rsquo;re ready.
              </p>
            )}
          </div>

          <div className="card p-5">
            <label className="label">Internal notes</label>
            <textarea
              className="input min-h-[90px]" placeholder="Only your team sees this."
              value={c.notes_internal} onChange={(e) => setC({ ...c, notes_internal: e.target.value })}
            />
          </div>
        </div>

        {/* rail */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-5">
            <p className="text-[14px] font-medium">Ownership</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">Account manager</label>
                <select className="input" value={c.account_manager}
                        onChange={(e) => setC({ ...c, account_manager: e.target.value })}>
                  <option value="">Unassigned</option>
                  {team.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Client since</label>
                <input type="date" className="input" value={c.client_since}
                       onChange={(e) => setC({ ...c, client_since: e.target.value })} />
              </div>
            </div>

            <button className="btn-primary mt-4 w-full" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Add client
            </button>
            <button className="btn-ghost mt-2 w-full text-muted" onClick={() => router.push("/clients")} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
