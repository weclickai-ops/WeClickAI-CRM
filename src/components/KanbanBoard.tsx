"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PipelineStage, StageGroup } from "@/lib/types";
import { Phone, ChevronDown, ChevronRight, Repeat } from "lucide-react";

type MiniLead = {
  id: string; business_name: string; phone: string | null;
  city: string | null; status: string; stage_id: string | null; website: string | null;
  next_followup_at: string | null; followups_enabled: boolean;
};

const GROUPS: { key: StageGroup; label: string; hint: string }[] = [
  { key: "todo",        label: "To-do",       hint: "Not worked yet" },
  { key: "in_progress", label: "In progress", hint: "Being chased" },
  { key: "complete",    label: "Complete",    hint: "Closed, one way or another" },
];

/**
 * Twelve stages, and on most days nearly all of them are empty.
 *
 * A conventional board gives every column the same tall slab whether it holds
 * forty cards or none, so the screen fills with identical grey boxes each
 * repeating "Drop leads here" — the layout fights the data instead of showing
 * it. Here an empty stage collapses to a thin dashed slot, the drop hint only
 * appears on the column you're actually dragging over, and the stage colour
 * runs along the top edge so you can find a column without reading it.
 */
export function KanbanBoard({ stages, leads: initial }:
  { stages: PipelineStage[]; leads: MiniLead[] }) {
  const supabase = createClient();
  const [leads, setLeads] = useState<MiniLead[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<StageGroup>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const firstStage = stages.find((s) => s.is_default)?.id ?? stages[0]?.id ?? null;
  const stageOf = (l: MiniLead) => l.stage_id ?? firstStage;
  const today = new Date().toISOString().slice(0, 10);

  async function drop(stageId: string) {
    if (!dragId) return;
    const id = dragId;
    const lead = leads.find((l) => l.id === id);
    setDragId(null);
    setOverStage(null);
    if (!lead || lead.stage_id === stageId) return;

    const before = lead.stage_id;
    const beforeStatus = lead.status;

    // Every stage declares the status it represents. Moving a card has to write
    // both, or the board and the Qualified / Won pages disagree — a lead sits in
    // the Qualified column while its status still says "new", so it never shows
    // up anywhere that filters on status.
    const nextStatus = stages.find((st) => st.id === stageId)?.maps_to_status ?? lead.status;

    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage_id: stageId, status: nextStatus } : l)));

    const { error: err } = await supabase
      .from("leads")
      .update({ stage_id: stageId, status: nextStatus })
      .eq("id", id);
    if (err) {
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage_id: before, status: beforeStatus } : l)));
      setError(
        err.message.toLowerCase().includes("row-level security")
          ? "You don't have permission to move that lead."
          : err.message
      );
    } else setError(null);
  }

  function toggle(g: StageGroup) {
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });
  }

  return (
    <>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-7">
        {GROUPS.map(({ key, label, hint }) => {
          const groupStages = stages.filter((s) => s.stage_group === key);
          if (groupStages.length === 0) return null;
          const count = leads.filter((l) =>
            groupStages.some((s) => s.id === stageOf(l))
          ).length;
          const isCollapsed = collapsed.has(key);

          return (
            <section key={key}>
              <div className="mb-2.5 flex items-baseline gap-3">
                <button
                  onClick={() => toggle(key)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase
                             tracking-[0.08em] text-muted transition-colors hover:text-ink"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5" />
                    : <ChevronDown className="h-3.5 w-3.5" />}
                  {label}
                  <span className="ml-0.5 font-normal tabular-nums normal-case tracking-normal
                                   text-ink">{count}</span>
                </button>
                <span className="hidden text-xs text-muted/70 sm:inline">{hint}</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              {!isCollapsed && (
                <div className="flex items-start gap-3 overflow-x-auto pb-2">
                  {groupStages.map((stage) => {
                    const items = leads.filter((l) => stageOf(l) === stage.id);
                    const isOver = overStage === stage.id;
                    const empty = items.length === 0;

                    return (
                      <div
                        key={stage.id}
                        onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
                        onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                        onDrop={() => drop(stage.id)}
                        className={`w-[264px] shrink-0 overflow-hidden rounded-xl transition-all
                          ${isOver
                            ? "bg-copper-soft ring-2 ring-copper/40"
                            : empty
                              ? "border border-dashed border-line bg-transparent"
                              : "border border-line bg-black/[0.018]"}`}
                      >
                        {/* the stage's colour, so columns are findable without reading */}
                        <div className="h-[3px] w-full" style={{ background: stage.color }} />

                        <div className="flex items-center justify-between px-3 py-2.5">
                          <span className={`text-[13px] font-semibold ${empty ? "text-muted" : "text-ink"}`}>
                            {stage.name}
                          </span>
                          <span className={`text-xs tabular-nums ${empty ? "text-muted/60" : "text-muted"}`}>
                            {items.length}
                          </span>
                        </div>

                        <div className={empty ? "" : "space-y-2 px-2 pb-2"}>
                          {items.map((l) => {
                            const due =
                              l.followups_enabled && l.next_followup_at && l.next_followup_at <= today;
                            return (
                              <div
                                key={l.id}
                                draggable
                                onDragStart={() => setDragId(l.id)}
                                onDragEnd={() => { setDragId(null); setOverStage(null); }}
                                className={`cursor-grab rounded-lg border border-line bg-surface p-2.5
                                            transition-shadow hover:shadow-sm active:cursor-grabbing
                                            ${dragId === l.id ? "opacity-40" : ""}`}
                              >
                                <Link href={`/leads/${l.id}`}
                                      className="block text-[13px] font-medium leading-snug hover:text-copper">
                                  {l.business_name}
                                </Link>

                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                                  {l.city && <span className="text-muted">{l.city}</span>}
                                  {!l.website && (
                                    <span className="rounded bg-copper-soft px-1.5 py-0.5 font-medium text-copper">
                                      no site
                                    </span>
                                  )}
                                  {due && (
                                    <span className="inline-flex items-center gap-0.5 rounded bg-red-50
                                                     px-1.5 py-0.5 font-medium text-red-700">
                                      <Repeat className="h-2.5 w-2.5" /> due
                                    </span>
                                  )}
                                </div>

                                {l.phone && (
                                  <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()}
                                     className="mt-1.5 inline-flex items-center gap-1 text-[11px]
                                                tabular-nums text-copper hover:underline">
                                    <Phone className="h-2.5 w-2.5" />{l.phone}
                                  </a>
                                )}
                              </div>
                            );
                          })}

                          {/* the hint belongs on the column you're aiming at, not all of them */}
                          {empty && (
                            <p className={`px-3 pb-3 text-center text-[11px] transition-colors
                                          ${isOver ? "text-copper" : "text-muted/50"}`}>
                              {isOver ? "Drop here" : dragId ? "—" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
