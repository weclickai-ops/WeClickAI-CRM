"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead, PipelineStage } from "@/lib/types";
import {
  Phone, MessageCircle, Check, Loader2, CalendarClock, PauseCircle, Instagram,
} from "lucide-react";

/** Whole days between two ISO dates, positive when the first is in the past. */
function daysBetween(from: string, to: string) {
  return Math.round((+new Date(to) - +new Date(from)) / 86_400_000);
}

export function TodayClient({
  due: initialDue, upcoming, stageMap, teamMap, today,
}: {
  due: Lead[];
  upcoming: Lead[];
  stageMap: Record<string, PipelineStage>;
  teamMap: Record<string, string>;
  today: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const due = initialDue.filter((l) => !done.has(l.id));

  /**
   * One call does both: writes the note and rolls next_followup_at forward by
   * the lead's interval, inside a single transaction. Doing it client-side in
   * two steps would leave the date un-rolled whenever the second write failed,
   * and the lead would sit on this list forever.
   */
  async function logFollowup(lead: Lead, withNote?: string) {
    setBusy(lead.id);
    setError(null);
    const { data, error: err } = await supabase.rpc("log_followup", {
      p_lead: lead.id,
      p_note: withNote ?? null,
    });
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    setDone((s) => new Set(s).add(lead.id));
    setNoteFor(null);
    setNote("");
    router.refresh();
    return data as string;
  }

  async function snooze(lead: Lead, days: number) {
    setBusy(lead.id);
    const next = new Date();
    next.setDate(next.getDate() + days);
    const { error: err } = await supabase
      .from("leads")
      .update({ next_followup_at: next.toISOString().slice(0, 10) })
      .eq("id", lead.id);
    setBusy(null);
    if (err) { setError(err.message); return; }
    setDone((s) => new Set(s).add(lead.id));
    router.refresh();
  }

  async function stop(lead: Lead) {
    setBusy(lead.id);
    const { error: err } = await supabase
      .from("leads").update({ followups_enabled: false }).eq("id", lead.id);
    setBusy(null);
    if (err) { setError(err.message); return; }
    setDone((s) => new Set(s).add(lead.id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {due.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <p className="font-display text-lg font-semibold">Nothing due today</p>
          <p className="mt-1.5 text-sm text-muted">
            {upcoming.length > 0
              ? `Next one is ${upcoming[0].next_followup_at}.`
              : "Turn on follow-ups from a lead to start a cycle."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {due.map((l) => {
            const overdue = l.next_followup_at
              ? daysBetween(l.next_followup_at, today)
              : 0;
            const stage = l.stage_id ? stageMap[l.stage_id] : undefined;
            return (
              <li key={l.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/leads/${l.id}`}
                            className="font-display text-base font-semibold hover:text-copper">
                        {l.business_name}
                      </Link>
                      {stage && (
                        <span className="chip" style={{ background: `${stage.color}22`, color: stage.color }}>
                          {stage.name}
                        </span>
                      )}
                      {overdue > 0 ? (
                        <span className="chip bg-red-50 text-red-700">
                          {overdue} day{overdue === 1 ? "" : "s"} overdue
                        </span>
                      ) : (
                        <span className="chip bg-amber-100 text-amber-800">due today</span>
                      )}
                    </div>

                    <p className="mt-1 text-[13px] text-muted">
                      {l.person_name && <>{l.person_name} · </>}
                      {l.city ?? "—"}
                      {l.assigned_to && <> · {teamMap[l.assigned_to] ?? ""}</>}
                      {l.last_followed_up_at && (
                        <> · last touched {new Date(l.last_followed_up_at).toLocaleDateString("en-IN")}</>
                      )}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {l.phone && (
                        <a href={`tel:${l.phone}`} className="btn-primary px-3 py-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5" /> Call {l.phone}
                        </a>
                      )}
                      {l.whatsapp && (
                        <a href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`}
                           target="_blank" rel="noreferrer"
                           className="btn-outline px-3 py-1.5 text-sm">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      )}
                      {l.instagram && (
                        <a href={l.instagram} target="_blank" rel="noreferrer"
                           className="btn-outline px-3 py-1.5 text-sm">
                          <Instagram className="h-3.5 w-3.5" /> Instagram
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button className="btn-primary px-3 py-1.5 text-sm"
                            disabled={busy === l.id}
                            onClick={() => setNoteFor(noteFor === l.id ? null : l.id)}>
                      {busy === l.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Check className="h-3.5 w-3.5" />}
                      Done
                    </button>
                    <button className="btn-outline px-2.5 py-1.5 text-sm" title="Push to tomorrow"
                            disabled={busy === l.id} onClick={() => snooze(l, 1)}>
                      <CalendarClock className="h-3.5 w-3.5" /> 1d
                    </button>
                    <button className="btn-outline px-2.5 py-1.5 text-sm" title="Push a week"
                            disabled={busy === l.id} onClick={() => snooze(l, 7)}>
                      7d
                    </button>
                    <button className="btn-ghost px-2 py-1.5 text-sm text-muted" title="Stop following up"
                            disabled={busy === l.id} onClick={() => stop(l)}>
                      <PauseCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {noteFor === l.id && (
                  <div className="mt-3 border-t border-line pt-3">
                    <label className="label">What happened?</label>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        autoFocus
                        className="input"
                        placeholder="Spoke to the owner, calling back Friday…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") logFollowup(l, note); }}
                      />
                      <button className="btn-primary" disabled={busy === l.id}
                              onClick={() => logFollowup(l, note)}>
                        Save
                      </button>
                      <button className="btn-ghost" onClick={() => logFollowup(l)}>
                        Skip note
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      Saves the note and moves the next follow-up on by{" "}
                      {l.followup_interval_days} day{l.followup_interval_days === 1 ? "" : "s"}.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {upcoming.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-display text-base font-semibold">Coming up</h2>
          </div>
          <ul>
            {upcoming.slice(0, 10).map((l) => (
              <li key={l.id} className="flex items-center justify-between border-b border-line px-5 py-2.5 last:border-0">
                <Link href={`/leads/${l.id}`} className="text-sm hover:text-copper">
                  {l.business_name}
                </Link>
                <span className="text-[13px] text-muted">{l.next_followup_at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
