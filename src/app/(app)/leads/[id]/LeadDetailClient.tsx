"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead, PipelineStage, CustomField, StageGroup } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import {
  Phone, ArrowLeft, Send, FileText, Globe, MapPin, Mail, User, Instagram,
  Linkedin, Facebook, Youtube, MessageCircle, Image as ImageIcon, X,
  Check, Loader2, AlertCircle, Repeat, PhoneCall, StickyNote,
} from "lucide-react";

const CALL_OUTCOMES = [
  { value: "connected", label: "Connected" },
  { value: "no_answer", label: "No answer" },
  { value: "busy", label: "Busy" },
  { value: "voicemail", label: "Voicemail" },
  { value: "wrong_number", label: "Wrong number" },
];
const GROUP_LABEL: Record<StageGroup, string> = {
  todo: "To-do", in_progress: "In progress", complete: "Complete",
};
const INTERVALS = [1, 2, 3, 5, 7, 14, 30];

/** One-tap scheduling. Days from today. */
const QUICK_FOLLOWUPS = [
  { label: "Today", days: 0 },   // due now — shows under Today on /follow-ups
  { label: "Tomorrow", days: 1 },
  { label: "+3 days", days: 3 },
  { label: "Next week", days: 7 },
];

/**
 * Local YYYY-MM-DD. Deliberately not toISOString() — that converts to UTC, so
 * before 05:30 IST it hands back yesterday's date.
 */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FieldKey =
  | "person_name" | "email" | "website" | "whatsapp" | "instagram"
  | "linkedin" | "facebook" | "x_handle" | "youtube" | "logo_url" | "city";

const CONTACT_FIELDS: { key: FieldKey; label: string; icon: any; type?: string }[] = [
  { key: "person_name", label: "Person",    icon: User },
  { key: "email",       label: "Email",     icon: Mail,     type: "email" },
  { key: "whatsapp",    label: "WhatsApp",  icon: MessageCircle, type: "tel" },
  { key: "website",     label: "Website",   icon: Globe,    type: "url" },
  { key: "instagram",   label: "Instagram", icon: Instagram, type: "url" },
  { key: "linkedin",    label: "LinkedIn",  icon: Linkedin, type: "url" },
  { key: "facebook",    label: "Facebook",  icon: Facebook, type: "url" },
  { key: "x_handle",    label: "X",         icon: X,        type: "url" },
  { key: "youtube",     label: "YouTube",   icon: Youtube,  type: "url" },
  { key: "logo_url",    label: "Logo",      icon: ImageIcon, type: "url" },
  { key: "city",        label: "City",      icon: MapPin },
];

/**
 * The lead page, rebuilt as a call console.
 *
 * What changed and why:
 *  · The number is now a sticky bar that follows you down the page. When you
 *    open a lead you are about to phone someone; that shouldn't scroll away.
 *  · Notes and Call history were two cards that each said "nothing here". They
 *    are one timeline now, because both answer the same question — what has
 *    happened with this lead — and interleaving them is how it actually reads.
 *  · The right rail held three dropdowns and a lot of nothing. It now carries
 *    stage, owner, follow-up, the missing-data checks, and every contact field,
 *    editable in place.
 */
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
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [outcome, setOutcome] = useState("connected");
  const [callNote, setCallNote] = useState("");

  const today = ymd(new Date());
  const overdue =
    lead.followups_enabled && lead.next_followup_at && lead.next_followup_at < today;
  const stage = stages.find((s) => s.id === lead.stage_id);
  const checks = [
    !lead.person_name && "Needs name",
    !lead.email && "Needs email",
    !lead.phone && "Needs phone",
  ].filter(Boolean) as string[];

  /** One timeline: what has happened, newest first. */
  const timeline = [
    ...notes.map((n) => ({ kind: "note" as const, at: n.created_at, body: n.body, meta: null })),
    ...calls.map((c) => ({
      kind: "call" as const, at: c.created_at, body: c.notes as string | null,
      meta: CALL_OUTCOMES.find((o) => o.value === c.outcome)?.label ?? c.outcome,
    })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  async function patch(f: Partial<Lead>, label = "field") {
    const before = lead;
    setSaving(label);
    setError(null);
    setLead((l) => ({ ...l, ...f }));
    const { error: err } = await supabase.from("leads").update(f).eq("id", lead.id);
    setSaving(null);
    if (err) { setLead(before); setError(err.message); return; }
    router.refresh();
  }

  async function addNote() {
    const body = noteBody.trim();
    if (!body) return;
    setSaving("note");
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: err } = await supabase.from("lead_notes")
      .insert({ lead_id: lead.id, body, author_id: user?.id }).select().single();
    setSaving(null);
    if (err) { setError(err.message); return; }
    if (data) setNotes([data, ...notes]);
    setNoteBody("");
  }

  async function logCall() {
    setSaving("call");
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: err } = await supabase.from("calls")
      .insert({ lead_id: lead.id, outcome, notes: callNote.trim() || null, agent_id: user?.id })
      .select().single();
    setSaving(null);
    if (err) { setError(err.message); return; }
    if (data) setCalls([data, ...calls]);
    setCallOpen(false);
    setCallNote("");
    if (lead.status === "new") patch({ status: "contacted" }, "status");
  }

  async function followedUp() {
    setSaving("followup");
    const { error: err } = await supabase.rpc("log_followup", { p_lead: lead.id, p_note: null });
    setSaving(null);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  /** One tap: switch follow-ups on and set the next touch N days out. */
  function scheduleIn(days: number) {
    const next = new Date();
    next.setDate(next.getDate() + days);
    patch({ followups_enabled: true, next_followup_at: ymd(next) }, "followup");
  }

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>

      {/* The call bar. Sticks to the top because the number is why you're here. */}
      <div className="sticky top-0 z-20 -mx-6 mb-5 border-b border-line bg-surface/95 px-6 py-3.5 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-xl font-semibold">{lead.business_name}</h1>
              {stage && (
                <span className="chip" style={{ background: `${stage.color}22`, color: stage.color }}>
                  {stage.name}
                </span>
              )}
              {!lead.website && <span className="chip bg-copper-soft text-copper">target</span>}
              {overdue && <span className="chip bg-red-50 text-red-700">follow-up overdue</span>}
            </div>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {lead.category?.replaceAll("_", " ")}
              {lead.person_name && <> · {lead.person_name}</>}
              {lead.city && <> · {lead.city}</>}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} onClick={() => setCallOpen(true)}
                 className="btn-primary tabular-nums">
                <Phone className="h-4 w-4" /> {lead.phone}
              </a>
            ) : (
              <span className="chip bg-red-50 text-red-700">no phone</span>
            )}
            <button className="btn-outline" onClick={() => setCallOpen(true)}>
              <PhoneCall className="h-4 w-4" /> Log a call
            </button>
            <Link href={`/invoices/new?lead=${lead.id}`} className="btn-ghost text-muted">
              <FileText className="h-4 w-4" /> Invoice
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* timeline */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="What happened? Add a note…"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
              />
              <button className="btn-primary shrink-0" onClick={addNote}
                      disabled={saving === "note" || !noteBody.trim()}>
                {saving === "note"
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-display text-base font-semibold">History</h2>
            </div>

            {timeline.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="text-sm text-muted">
                  Nothing logged yet. Call them, then record what happened —
                  it's what makes the follow-up worth anything.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {timeline.map((t, i) => (
                  <li key={i} className="flex gap-3 px-5 py-3.5">
                    <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full
                                      ${t.kind === "call" ? "bg-copper-soft" : "bg-black/5"}`}>
                      {t.kind === "call"
                        ? <PhoneCall className="h-3.5 w-3.5 text-copper" />
                        : <StickyNote className="h-3.5 w-3.5 text-muted" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium">
                          {t.kind === "call" ? t.meta : "Note"}
                        </span>
                        <span className="text-xs text-muted">{timeAgo(t.at)}</span>
                      </div>
                      {t.body && <p className="mt-0.5 text-sm leading-relaxed">{t.body}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* working panel */}
        <div className="space-y-4">
          <div className="card p-5">
            {checks.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {checks.map((c) => (
                  <span key={c} className="chip inline-flex items-center gap-1 bg-red-50 text-red-700">
                    <AlertCircle className="h-3 w-3" /> {c}
                  </span>
                ))}
              </div>
            )}

            <label className="label">Stage</label>
            <select className="input mt-1" value={lead.stage_id ?? ""}
                    onChange={(e) => patch({ stage_id: e.target.value }, "stage")}>
              {(["todo", "in_progress", "complete"] as StageGroup[]).map((g) => (
                <optgroup key={g} label={GROUP_LABEL[g]}>
                  {stages.filter((s) => s.stage_group === g).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            <label className="label mt-3">Owner</label>
            <select className="input mt-1" value={lead.assigned_to ?? ""}
                    onChange={(e) => patch({ assigned_to: e.target.value || null }, "owner")}>
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>
              ))}
            </select>
          </div>

          {/* follow-up */}
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                <Repeat className="h-4 w-4 text-muted" /> Follow-up
              </p>
              {lead.followups_enabled ? (
                <span className={`chip ${overdue ? "bg-red-50 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>
                  {overdue ? "overdue" : lead.next_followup_at}
                </span>
              ) : (
                <span className="chip bg-black/5 text-muted">off</span>
              )}
            </div>

            {/* One tap here is what puts the lead on the Follow-ups page. */}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {QUICK_FOLLOWUPS.map((q) => {
                const on = lead.followups_enabled && lead.next_followup_at === ymd(
                  (() => { const d = new Date(); d.setDate(d.getDate() + q.days); return d; })()
                );
                return (
                  <button key={q.label}
                          className={`btn-outline px-1 py-1.5 text-xs ${on ? "border-copper text-copper" : ""}`}
                          onClick={() => scheduleIn(q.days)}
                          disabled={saving === "followup"}>
                    {q.label}
                  </button>
                );
              })}
            </div>

            {lead.followups_enabled ? (
              <div className="mt-2.5 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Next</label>
                    <input type="date" className="input mt-1 py-1.5 text-sm"
                           value={lead.next_followup_at ?? ""}
                           onChange={(e) => patch({ next_followup_at: e.target.value }, "next")} />
                  </div>
                  <div>
                    <label className="label">Then every</label>
                    <select className="input mt-1 py-1.5 text-sm" value={lead.followup_interval_days}
                            onChange={(e) => patch({ followup_interval_days: Number(e.target.value) }, "interval")}>
                      {INTERVALS.map((d) => (
                        <option key={d} value={d}>{d === 1 ? "1 day" : `${d} days`}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button className="btn-primary w-full text-sm" onClick={followedUp}
                        disabled={saving === "followup"}>
                  {saving === "followup"
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Check className="h-4 w-4" />}
                  Followed up
                </button>
              </div>
            ) : (
              <p className="mt-2.5 text-xs leading-relaxed text-muted">
                Not scheduled. Pick a day above and this lead appears under
                Follow-ups until someone works it.
              </p>
            )}
          </div>

          {/* contact fields, editable in place */}
          <div className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <p className="text-sm font-medium">Details</p>
            </div>
            <div className="divide-y divide-line">
              <div className="flex items-center gap-3 px-4 py-2">
                <span className="inline-flex w-24 shrink-0 items-center gap-2 text-[13px] text-muted">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </span>
                <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
                       placeholder="Empty" defaultValue={lead.phone ?? ""}
                       onBlur={(e) => {
                         const v = e.target.value.trim() || null;
                         if (v !== lead.phone) patch({ phone: v }, "phone");
                       }} />
              </div>
              {CONTACT_FIELDS.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.key} className="flex items-center gap-3 px-4 py-2">
                    <span className="inline-flex w-24 shrink-0 items-center gap-2 text-[13px] text-muted">
                      <Icon className="h-3.5 w-3.5 shrink-0" /> {f.label}
                    </span>
                    <input
                      type={f.type ?? "text"}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
                      placeholder="Empty"
                      defaultValue={(lead[f.key] as string | null) ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== (lead[f.key] ?? null)) patch({ [f.key]: v } as Partial<Lead>, f.key);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {fields.length > 0 && (
            <div className="card p-5">
              <p className="mb-3 text-sm font-medium">Custom fields</p>
              <div className="space-y-2.5">
                {fields.map((f) => (
                  <div key={f.id}>
                    <label className="label">{f.label}</label>
                    <input
                      className="input mt-1 py-1.5 text-sm"
                      defaultValue={String((lead.custom_data as any)?.[f.key] ?? "")}
                      onBlur={(e) => {
                        const next = { ...(lead.custom_data ?? {}), [f.key]: e.target.value };
                        patch({ custom_data: next }, f.key);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="px-1 text-xs text-muted">
            {lead.source === "scrape" ? "Found by the scraper" : `Source: ${lead.source}`} ·
            added {timeAgo(lead.created_at)}
          </p>
        </div>
      </div>

      {/* log a call */}
      {callOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setCallOpen(false)} />
          <div role="dialog" aria-label="Log a call"
               className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2
                          rounded-xl2 border border-line bg-surface p-5 shadow-2xl">
            <h2 className="font-display text-lg font-semibold">How did it go?</h2>
            <p className="mt-0.5 text-[13px] text-muted">{lead.business_name}</p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {CALL_OUTCOMES.map((o) => (
                <button key={o.value} onClick={() => setOutcome(o.value)}
                        className={`chip ${outcome === o.value
                          ? "bg-copper text-white"
                          : "bg-black/5 text-muted hover:text-ink"}`}>
                  {o.label}
                </button>
              ))}
            </div>

            <textarea className="input mt-3" rows={3} placeholder="Anything worth remembering…"
                      value={callNote} onChange={(e) => setCallNote(e.target.value)} />

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setCallOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={logCall} disabled={saving === "call"}>
                {saving === "call" && <Loader2 className="h-4 w-4 animate-spin" />}
                Save call
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
