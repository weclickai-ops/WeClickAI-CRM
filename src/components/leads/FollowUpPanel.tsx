"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";
import { Bell, BellOff, Loader2, Check } from "lucide-react";

const INTERVALS = [1, 2, 3, 5, 7, 14, 30];

/**
 * Follow-up controls for one lead. Turning it on starts a cycle; the lead then
 * appears on Today when the date comes round, and stays there until someone
 * marks it done.
 */
export function FollowUpPanel({ lead: initial }: { lead: Lead }) {
  const router = useRouter();
  const supabase = createClient();
  const [lead, setLead] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    lead.followups_enabled && lead.next_followup_at && lead.next_followup_at < today;

  async function patch(fields: Partial<Lead>) {
    const before = lead;
    setBusy(true);
    setError(null);
    setLead((l) => ({ ...l, ...fields }));
    const { error: err } = await supabase.from("leads").update(fields).eq("id", lead.id);
    setBusy(false);
    if (err) {
      setLead(before);
      setError(err.message);
      return;
    }
    router.refresh();
  }

  function start() {
    const next = new Date();
    next.setDate(next.getDate() + lead.followup_interval_days);
    patch({
      followups_enabled: true,
      next_followup_at: next.toISOString().slice(0, 10),
    });
  }

  /** Records the touch and rolls the date forward in one transaction. */
  async function logNow() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("log_followup", {
      p_lead: lead.id,
      p_note: null,
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Follow-up</h2>
        {lead.followups_enabled ? (
          <span className={`chip ${overdue ? "bg-red-50 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>
            {overdue ? "overdue" : "on"}
          </span>
        ) : (
          <span className="chip bg-black/5 text-muted">off</span>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
      )}

      {lead.followups_enabled ? (
        <>
          <div className="mt-4">
            <label className="label">Next follow-up</label>
            <input
              type="date"
              className="input mt-1"
              value={lead.next_followup_at ?? ""}
              onChange={(e) => patch({ next_followup_at: e.target.value })}
            />
          </div>

          <div className="mt-3">
            <label className="label">Repeat every</label>
            <select
              className="input mt-1"
              value={lead.followup_interval_days}
              onChange={(e) => patch({ followup_interval_days: Number(e.target.value) })}
            >
              {INTERVALS.map((d) => (
                <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>
              ))}
            </select>
          </div>

          {lead.last_followed_up_at && (
            <p className="mt-3 text-xs text-muted">
              Last touched {new Date(lead.last_followed_up_at).toLocaleString("en-IN")}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button className="btn-primary flex-1" onClick={logNow} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Followed up
            </button>
            <button className="btn-ghost text-muted" title="Stop following up"
                    onClick={() => patch({ followups_enabled: false })} disabled={busy}>
              <BellOff className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Turn this on and the lead appears on Today when it's due, and keeps
            appearing until someone works it.
          </p>
          <div className="mt-3">
            <label className="label">Repeat every</label>
            <select
              className="input mt-1"
              value={lead.followup_interval_days}
              onChange={(e) => patch({ followup_interval_days: Number(e.target.value) })}
            >
              {INTERVALS.map((d) => (
                <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary mt-3 w-full" onClick={start} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Start following up
          </button>
        </>
      )}
    </div>
  );
}
