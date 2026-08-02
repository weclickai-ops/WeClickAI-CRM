"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cx } from "@/lib/utils";
import type { PipelineStage, LeadStatus, StageGroup } from "@/lib/types";
import {
  Plus, Trash2, Loader2, Check, X, GripVertical, ChevronUp, ChevronDown, Info,
} from "lucide-react";

const GROUPS: { value: StageGroup; label: string }[] = [
  { value: "todo", label: "To-do" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
];

/**
 * Every stage has to declare which status it represents. Pages like
 * Qualified and Analytics filter on status, not stage name — so a stage
 * with no mapping is invisible to them.
 */
const STATUSES: { value: LeadStatus; label: string; note: string }[] = [
  { value: "new",       label: "New",       note: "Not contacted yet" },
  { value: "contacted", label: "Contacted", note: "Reached out, no outcome yet" },
  { value: "qualified", label: "Qualified", note: "Live opportunity — shows on the Qualified page" },
  { value: "won",       label: "Won",       note: "Closed, they're a customer" },
  { value: "lost",      label: "Lost",      note: "Dead, junk or rejected" },
];

const COLOURS = ["#8A8F98", "#B87333", "#D98A4B", "#C9752E", "#3E7C59", "#9B4A3B", "#3B82F6", "#8B5CF6"];

type Row = PipelineStage & { _count?: number };

export function StagesClient({
  stages: initial,
  counts,
}: {
  stages: PipelineStage[];
  counts: Record<string, number>;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [stages, setStages] = useState<Row[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: "", maps_to_status: "new" as LeadStatus,
    stage_group: "todo" as StageGroup, color: COLOURS[0],
  });

  async function reload() {
    const { data } = await supabase.from("pipeline_stages").select("*").order("position");
    setStages((data ?? []) as Row[]);
    router.refresh();
  }

  async function patch(id: string, changes: Partial<PipelineStage>) {
    setStages((s) => s.map((x) => (x.id === id ? { ...x, ...changes } : x)));
    setBusy(id);
    const { error: err } = await supabase.from("pipeline_stages").update(changes).eq("id", id);
    setBusy(null);
    if (err) { setError(err.message); reload(); return; }
    router.refresh();
  }

  async function add() {
    if (!draft.name.trim()) { setError("Give the stage a name."); return; }
    setBusy("new"); setError(null);
    const { error: err } = await supabase.from("pipeline_stages").insert({
      name: draft.name.trim(),
      maps_to_status: draft.maps_to_status,
      stage_group: draft.stage_group,
      color: draft.color,
      position: stages.length,
      is_won: draft.maps_to_status === "won",
      is_lost: draft.maps_to_status === "lost",
      is_default: false,
    });
    setBusy(null);
    if (err) { setError(err.message); return; }
    setDraft({ name: "", maps_to_status: "new", stage_group: "todo", color: COLOURS[0] });
    setAdding(false);
    reload();
  }

  async function remove(id: string) {
    const n = counts[id] ?? 0;
    setBusy(id); setError(null);
    // Leads keep existing — stage_id just goes null, and they fall back to the
    // default stage on the board. Nothing is lost.
    const { error: err } = await supabase.from("pipeline_stages").delete().eq("id", id);
    setBusy(null); setConfirming(null);
    if (err) {
      setError(
        err.message.toLowerCase().includes("foreign key")
          ? `Move those ${n} leads to another stage first.`
          : err.message
      );
      return;
    }
    reload();
  }

  async function move(id: string, dir: -1 | 1) {
    const i = stages.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= stages.length) return;

    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    setStages(next);
    setBusy(id);
    // Rewrite every position — cheap at this size, and immune to gaps.
    await Promise.all(
      next.map((s, idx) => supabase.from("pipeline_stages").update({ position: idx }).eq("id", s.id))
    );
    setBusy(null);
    router.refresh();
  }

  async function makeDefault(id: string) {
    setBusy(id);
    await supabase.from("pipeline_stages").update({ is_default: false }).neq("id", id);
    await supabase.from("pipeline_stages").update({ is_default: true }).eq("id", id);
    setBusy(null);
    reload();
  }

  const qualifiedCount = stages.filter((s) => s.maps_to_status === "qualified").length;

  return (
    <>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {qualifiedCount === 0 && (
        <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="text-[13px] leading-relaxed text-amber-900">
            <p className="font-medium">No stage means &ldquo;qualified&rdquo;</p>
            <p className="mt-0.5">
              The Qualified page will stay empty until at least one stage maps to
              that status. Pick whichever stage means &ldquo;we&rsquo;ve spoken and
              there&rsquo;s a real opportunity&rdquo;.
            </p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th w-10"></th>
                <th className="th">Stage</th>
                <th className="th">Column</th>
                <th className="th">Counts as</th>
                <th className="th text-right">Leads</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-black/[0.012]">
                  <td className="td">
                    <div className="flex flex-col">
                      <button className="text-muted hover:text-ink disabled:opacity-25"
                              onClick={() => move(s.id, -1)} disabled={i === 0 || busy !== null}>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button className="text-muted hover:text-ink disabled:opacity-25"
                              onClick={() => move(s.id, 1)} disabled={i === stages.length - 1 || busy !== null}>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  <td className="td">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        className="h-6 w-6 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0"
                        value={s.color}
                        onChange={(e) => patch(s.id, { color: e.target.value })}
                      />
                      <input
                        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] font-medium outline-none focus:ring-0"
                        value={s.name}
                        onChange={(e) => setStages((x) => x.map((y) => y.id === s.id ? { ...y, name: e.target.value } : y))}
                        onBlur={(e) => patch(s.id, { name: e.target.value.trim() || s.name })}
                      />
                      {s.is_default && (
                        <span className="chip shrink-0 bg-copper-soft text-[11px] text-copper">default</span>
                      )}
                    </div>
                  </td>

                  <td className="td">
                    <select
                      className="input py-1 text-[12px]"
                      value={s.stage_group}
                      onChange={(e) => patch(s.id, { stage_group: e.target.value as StageGroup })}
                    >
                      {GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </td>

                  <td className="td">
                    <select
                      className="input py-1 text-[12px]"
                      value={s.maps_to_status}
                      onChange={(e) => {
                        const v = e.target.value as LeadStatus;
                        patch(s.id, { maps_to_status: v, is_won: v === "won", is_lost: v === "lost" });
                      }}
                    >
                      {STATUSES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                    </select>
                  </td>

                  <td className="td text-right text-[13px] tabular-nums text-muted">
                    {counts[s.id] ?? 0}
                  </td>

                  <td className="td">
                    <div className="flex items-center justify-end gap-1.5">
                      {busy === s.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
                      {!s.is_default && (
                        <button className="btn-ghost px-2 py-1 text-[11px] text-muted"
                                onClick={() => makeDefault(s.id)} title="New leads start here">
                          Set default
                        </button>
                      )}
                      {confirming === s.id ? (
                        <span className="flex gap-1.5">
                          <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(s.id)}>
                            Delete
                          </button>
                          <button className="btn-ghost px-2 py-1 text-xs text-muted" onClick={() => setConfirming(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button className="btn-ghost px-2 py-1" onClick={() => setConfirming(s.id)}
                                disabled={s.is_default} title={s.is_default ? "Can't delete the default stage" : "Delete"}>
                          <Trash2 className={cx("h-3.5 w-3.5", s.is_default ? "text-muted/30" : "text-muted")} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adding ? (
        <div className="card mt-4 p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-base font-semibold">New stage</p>
            <button className="btn-ghost px-1.5 py-1" onClick={() => setAdding(false)}>
              <X className="h-4 w-4 text-muted" />
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Name</label>
              <input className="input" placeholder="Proposal sent" value={draft.name}
                     onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Column</label>
              <select className="input" value={draft.stage_group}
                      onChange={(e) => setDraft({ ...draft, stage_group: e.target.value as StageGroup })}>
                {GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Counts as</label>
              <select className="input" value={draft.maps_to_status}
                      onChange={(e) => setDraft({ ...draft, maps_to_status: e.target.value as LeadStatus })}>
                {STATUSES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-muted">
                {STATUSES.find((st) => st.value === draft.maps_to_status)?.note}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Colour</label>
              <div className="mt-1 flex gap-2">
                {COLOURS.map((c) => (
                  <button key={c} onClick={() => setDraft({ ...draft, color: c })}
                          className={cx("h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110",
                                        draft.color === c ? "border-ink" : "border-transparent")}
                          style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button className="btn-primary" onClick={add} disabled={busy === "new"}>
              {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Add stage
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-outline mt-4" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add a stage
        </button>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Deleting a stage keeps its leads — they fall back to the default stage.
        The order here is the order columns appear on the Pipeline.
      </p>
    </>
  );
}
