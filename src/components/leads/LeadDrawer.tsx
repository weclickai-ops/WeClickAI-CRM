"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead, PipelineStage, Profile } from "@/lib/types";
import {
  X, Phone, MapPin, Mail, Globe, Instagram, Linkedin, Facebook,
  Youtube, MessageCircle, Image as ImageIcon, User, ExternalLink,
  Bell, Check, Loader2, AlertCircle, Repeat,
} from "lucide-react";

const GROUP_LABEL: Record<string, string> = {
  todo: "To-do",
  in_progress: "In progress",
  complete: "Complete",
};

const INTERVALS = [1, 2, 3, 5, 7, 14, 30];

type FieldKey =
  | "person_name" | "phone" | "city" | "facebook" | "instagram" | "email"
  | "website" | "linkedin" | "whatsapp" | "address" | "logo_url"
  | "x_handle" | "youtube";

const FIELDS: { key: FieldKey; label: string; icon: any; type?: string }[] = [
  { key: "person_name", label: "Person",     icon: User },
  { key: "phone",       label: "Phone",      icon: Phone,   type: "tel" },
  { key: "city",        label: "Place",      icon: MapPin },
  { key: "email",       label: "Email",      icon: Mail,    type: "email" },
  { key: "website",     label: "Website",    icon: Globe,   type: "url" },
  { key: "instagram",   label: "Instagram",  icon: Instagram, type: "url" },
  { key: "whatsapp",    label: "WhatsApp",   icon: MessageCircle, type: "tel" },
  { key: "linkedin",    label: "LinkedIn",   icon: Linkedin, type: "url" },
  { key: "facebook",    label: "Facebook",   icon: Facebook, type: "url" },
  { key: "x_handle",    label: "X",          icon: X,        type: "url" },
  { key: "youtube",     label: "YouTube",    icon: Youtube,  type: "url" },
  { key: "logo_url",    label: "Logo",       icon: ImageIcon, type: "url" },
  { key: "address",     label: "Other info", icon: MapPin },
];

/**
 * The Notion-style slide-over.
 *
 * Clicking a lead opens this rather than navigating away, so you keep your place
 * in the list — which matters when you're working down a call list and don't
 * want to lose your filters and scroll position on every lead.
 *
 * Every field saves on blur. There is no Save button on purpose: a form that can
 * be closed with unsaved edits is a form that loses work.
 */
export function LeadDrawer({
  lead: initial, stages, team, onClose,
}: {
  lead: Lead;
  stages: PipelineStage[];
  team: Pick<Profile, "id" | "full_name" | "email">[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [lead, setLead] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reopening on a different row must show that row, not the first one opened.
  useEffect(() => setLead(initial), [initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    lead.followups_enabled && lead.next_followup_at && lead.next_followup_at < today;
  const stage = stages.find((s) => s.id === lead.stage_id);

  const checks = [
    !lead.person_name && "Needs name",
    !lead.email && "Needs email",
    !lead.phone && "Needs phone",
  ].filter(Boolean) as string[];

  async function save(fields: Partial<Lead>, label: string) {
    const before = lead;
    setSaving(label);
    setError(null);
    setLead((l) => ({ ...l, ...fields }));
    const { error: err } = await supabase.from("leads").update(fields).eq("id", lead.id);
    setSaving(null);
    if (err) {
      setLead(before);
      setError(err.message);
      return;
    }
    router.refresh();
  }

  async function followedUp() {
    setSaving("followup");
    setError(null);
    const { error: err } = await supabase.rpc("log_followup", {
      p_lead: lead.id, p_note: null,
    });
    setSaving(null);
    if (err) { setError(err.message); return; }
    router.refresh();
    onClose();
  }

  function startFollowups() {
    const next = new Date();
    next.setDate(next.getDate() + lead.followup_interval_days);
    save(
      { followups_enabled: true, next_followup_at: next.toISOString().slice(0, 10) },
      "followup"
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />

      <aside
        role="dialog"
        aria-label={lead.business_name}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col
                   overflow-y-auto border-l border-line bg-surface shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line
                        bg-surface/95 px-5 py-3 backdrop-blur">
          <Link href={`/leads/${lead.id}`}
                className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-copper">
            <ExternalLink className="h-3.5 w-3.5" /> Open full page
          </Link>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
            <button onClick={onClose} aria-label="Close" className="btn-ghost px-2">
              <X className="h-4 w-4 text-muted" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <input
            className="w-full bg-transparent font-display text-2xl font-semibold outline-none"
            defaultValue={lead.business_name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== lead.business_name) save({ business_name: v }, "name");
            }}
          />

          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
          )}

          {/* status row */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="label">Status</p>
              <select
                className="input mt-1 py-1.5 text-sm"
                value={lead.stage_id ?? ""}
                onChange={(e) => save({ stage_id: e.target.value }, "stage")}
              >
                {["todo", "in_progress", "complete"].map((g) => (
                  <optgroup key={g} label={GROUP_LABEL[g]}>
                    {stages.filter((s) => s.stage_group === g).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <p className="label">Owner</p>
              <select
                className="input mt-1 py-1.5 text-sm"
                value={lead.assigned_to ?? ""}
                onChange={(e) => save({ assigned_to: e.target.value || null }, "owner")}
              >
                <option value="">Unassigned</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>
                ))}
              </select>
            </div>
          </div>

          {/* checks */}
          {checks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {checks.map((c) => (
                <span key={c} className="chip inline-flex items-center gap-1 bg-red-50 text-red-700">
                  <AlertCircle className="h-3 w-3" /> {c}
                </span>
              ))}
            </div>
          )}

          {/* bio */}
          <div className="mt-4">
            <p className="label">Bio</p>
            <textarea
              className="input mt-1 text-sm"
              rows={2}
              placeholder="What do they do?"
              defaultValue={lead.bio ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== lead.bio) save({ bio: v }, "bio");
              }}
            />
          </div>

          {/* follow-up */}
          <div className="mt-4 rounded-xl2 border border-line p-3.5">
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

            {lead.followups_enabled ? (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="label">Next</p>
                    <input type="date" className="input mt-1 py-1.5 text-sm"
                           value={lead.next_followup_at ?? ""}
                           onChange={(e) => save({ next_followup_at: e.target.value }, "next")} />
                  </div>
                  <div>
                    <p className="label">Interval</p>
                    <select className="input mt-1 py-1.5 text-sm"
                            value={lead.followup_interval_days}
                            onChange={(e) => save({ followup_interval_days: Number(e.target.value) }, "interval")}>
                      {INTERVALS.map((d) => <option key={d} value={d}>{d} days</option>)}
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
              <button className="btn-outline mt-3 w-full text-sm" onClick={startFollowups}
                      disabled={saving === "followup"}>
                <Bell className="h-4 w-4" /> Start following up
              </button>
            )}
          </div>

          {/* quick actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="btn-primary px-3 py-1.5 text-sm">
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
            )}
            {lead.whatsapp && (
              <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`}
                 target="_blank" rel="noreferrer" className="btn-outline px-3 py-1.5 text-sm">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
          </div>

          {/* properties */}
          <p className="label mt-5">Properties</p>
          <div className="mt-1.5 divide-y divide-line rounded-xl2 border border-line">
            {FIELDS.map((f) => {
              const Icon = f.icon;
              const value = (lead[f.key] as string | null) ?? "";
              return (
                <div key={f.key} className="flex items-center gap-3 px-3 py-2">
                  <span className="inline-flex w-28 shrink-0 items-center gap-2 text-[13px] text-muted">
                    <Icon className="h-3.5 w-3.5 shrink-0" /> {f.label}
                  </span>
                  <input
                    type={f.type ?? "text"}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
                    placeholder="Empty"
                    defaultValue={value}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (lead[f.key] ?? null)) save({ [f.key]: v } as Partial<Lead>, f.key);
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between pb-6 text-xs text-muted">
            <span>Added {new Date(lead.created_at).toLocaleDateString("en-IN")}</span>
            <button
              className="hover:text-red-600"
              onClick={() => save({ archived: !lead.archived }, "archive")}
            >
              {lead.archived ? "Unarchive" : "Archive"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
