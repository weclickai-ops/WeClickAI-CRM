"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { timeAgo } from "@/lib/utils";
import type { Lead, LeadStatus, PipelineStage, CustomField } from "@/lib/types";
import {
  Phone, Globe, MapPin, Mail, ArrowLeft, Send, FileText, PhoneCall,
} from "lucide-react";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];
const CALL_OUTCOMES = ["connected", "no_answer", "busy", "voicemail", "wrong_number"];

export function LeadDetailClient({
  lead: initialLead, initialNotes, initialCalls, team, stages, fields,
}: {
  lead: Lead;
  initialNotes: any[];
  initialCalls: any[];
  team: { id: string; full_name: string | null; email: string }[];
  stages: PipelineStage[];
  fields: CustomField[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [notes, setNotes] = useState(initialNotes);
  const [calls, setCalls] = useState(initialCalls);
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  async function patch(fields: Partial<Lead>) {
    setLead((l) => ({ ...l, ...fields }));
    await supabase.from("leads").update(fields).eq("id", lead.id);
    router.refresh();
  }

  async function addNote() {
    if (!noteBody.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("lead_notes")
      .insert({ lead_id: lead.id, body: noteBody.trim(), author_id: user?.id })
      .select().single();
    if (data) setNotes([data, ...notes]);
    setNoteBody(""); setSaving(false);
  }

  async function setCustom(key: string, value: unknown) {
    const next = { ...(lead.custom_data ?? {}), [key]: value };
    setLead((l) => ({ ...l, custom_data: next }));
    await supabase.from("leads").update({ custom_data: next }).eq("id", lead.id);
  }

  async function logCall(outcome: string, callNotes: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("calls").insert({
      lead_id: lead.id, agent_id: user?.id, phone: lead.phone, outcome, notes: callNotes,
    }).select().single();
    if (data) setCalls([data, ...calls]);
    // a call usually means we contacted them
    if (lead.status === "new") await patch({ status: "contacted" });
    setCallOpen(false);
  }

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-semibold">{lead.business_name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  {lead.category && <span>{lead.category.replaceAll("_", " ")}</span>}
                  {!lead.website && <span className="chip bg-copper-soft text-copper">no website</span>}
                </div>
              </div>
              <StatusBadge status={lead.status} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {lead.phone && (
                <a href={`tel:${lead.phone}`}
                   className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:border-copper">
                  <Phone className="h-4 w-4 text-copper" />
                  <span className="text-sm">{lead.phone}</span>
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                  <Mail className="h-4 w-4 text-muted" /><span className="text-sm">{lead.email}</span>
                </a>
              )}
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer"
                   className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                  <Globe className="h-4 w-4 text-muted" /><span className="truncate text-sm">{lead.website}</span>
                </a>
              )}
              {lead.address && (
                <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                  <MapPin className="h-4 w-4 text-muted" /><span className="truncate text-sm">{lead.address}</span>
                </div>
              )}
            </div>

            {/* click-to-call */}
            <div className="mt-5 flex flex-wrap gap-2">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} onClick={() => setCallOpen(true)} className="btn-primary">
                  <PhoneCall className="h-4 w-4" /> Call now
                </a>
              )}
              <Link href={`/invoices/new?lead=${lead.id}`} className="btn-outline">
                <FileText className="h-4 w-4" /> Create invoice
              </Link>
            </div>
          </div>

          {/* custom fields */}
          {fields.length > 0 && (
            <div className="card p-6">
              <h2 className="font-display text-lg font-semibold">Details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {fields.map((f) => (
                  <CustomFieldInput key={f.id} field={f}
                    value={(lead.custom_data ?? {})[f.key]}
                    onChange={(v) => setCustom(f.key, v)} />
                ))}
              </div>
            </div>
          )}

          {/* notes */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold">Notes</h2>
            <div className="mt-3 flex gap-2">
              <input className="input" placeholder="Add a note…" value={noteBody}
                     onChange={(e) => setNoteBody(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
              <button className="btn-primary" onClick={addNote} disabled={saving}>
                <Send className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 space-y-3">
              {notes.length === 0 && <li className="text-sm text-muted">No notes yet.</li>}
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-black/[0.02] px-3 py-2.5">
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{timeAgo(n.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* call history */}
          <div className="card p-6">
            <h2 className="font-display text-lg font-semibold">Call history</h2>
            <ul className="mt-3 space-y-2">
              {calls.length === 0 && <li className="text-sm text-muted">No calls logged.</li>}
              {calls.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                  <span className="text-sm capitalize">{(c.outcome ?? "logged").replaceAll("_", " ")}</span>
                  {c.notes && <span className="flex-1 truncate px-3 text-sm text-muted">{c.notes}</span>}
                  <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* sidebar column */}
        <div className="space-y-4">
          <div className="card p-5">
            <label className="label">Status</label>
            <select className="input mb-4 capitalize" value={lead.status}
                    onChange={(e) => patch({ status: e.target.value as LeadStatus })}>
              {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>

            <label className="label">Pipeline stage</label>
            <select className="input mb-4" value={lead.stage_id ?? ""}
                    onChange={(e) => patch({ stage_id: e.target.value || null })}>
              <option value="">— none —</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <label className="label">Assigned to</label>
            <select className="input" value={lead.assigned_to ?? ""}
                    onChange={(e) => patch({ assigned_to: e.target.value || null })}>
              <option value="">— unassigned —</option>
              {team.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
            </select>
          </div>

          <div className="card p-5 text-sm text-muted">
            <p>Source: <span className="capitalize text-ink">{lead.source}</span></p>
            <p className="mt-1">Added {timeAgo(lead.created_at)}</p>
          </div>
        </div>
      </div>

      {callOpen && lead.phone && (
        <CallModal phone={lead.phone} onClose={() => setCallOpen(false)} onLog={logCall} />
      )}
    </>
  );
}

function CustomFieldInput({ field, value, onChange }:
  { field: CustomField; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div>
      <label className="label">{field.label}</label>
      {field.field_type === "select" ? (
        <select className="input" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.field_type === "checkbox" ? (
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)}
               className="h-4 w-4 accent-copper" />
      ) : (
        <input className="input" type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
               value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function CallModal({ phone, onClose, onLog }:
  { phone: string; onClose: () => void; onLog: (outcome: string, notes: string) => void }) {
  const [outcome, setOutcome] = useState("connected");
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-semibold">Log this call</h3>
        <p className="mt-1 text-sm text-muted">Calling {phone}</p>
        <label className="label mt-4">Outcome</label>
        <select className="input capitalize" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {CALL_OUTCOMES.map((o) => <option key={o} value={o} className="capitalize">{o.replaceAll("_", " ")}</option>)}
        </select>
        <label className="label mt-4">Notes</label>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was said?" />
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onLog(outcome, notes)}>Save call log</button>
        </div>
      </div>
    </div>
  );
}
