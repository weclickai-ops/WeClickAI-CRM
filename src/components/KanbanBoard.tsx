"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PipelineStage, StageGroup } from "@/lib/types";
import { Phone, ChevronDown, ChevronRight } from "lucide-react";

type MiniLead = {
  id: string; business_name: string; phone: string | null;
  city: string | null; status: string; stage_id: string | null; website: string | null;
};

const GROUPS: { key: StageGroup; label: string }[] = [
  { key: "todo", label: "To-do" },
  { key: "in_progress", label: "In progress" },
  { key: "complete", label: "Complete" },
];

/**
 * Twelve stages side by side is a lot of horizontal scrolling to find anything.
 * Grouping them the way your Notion does — To-do, In progress, Complete — means
 * each row is short enough to scan, and a group you don't need can be folded
 * away.
 *
 * Status now follows the stage automatically (a database trigger does it), so
 * this component no longer has to keep the two in step itself.
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

  async function drop(stageId: string) {
    if (!dragId) return;
    const id = dragId;
    const lead = leads.find((l) => l.id === id);
    setDragId(null);
    setOverStage(null);
    if (!lead || lead.stage_id === stageId) return;

    const before = lead.stage_id;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage_id: stageId } : l)));

    const { error: err } = await supabase.from("leads").update({ stage_id: stageId }).eq("id", id);
    if (err) {
      // Put the card back — the move did not happen.
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage_id: before } : l)));
      setError(
        err.message.toLowerCase().includes("row-level security")
          ? "You don't have permission to move that lead."
          : err.message
      );
    } else {
      setError(null);
    }
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

      <div className="space-y-5">
        {GROUPS.map(({ key, label }) => {
          const groupStages = stages.filter((s) => s.stage_group === key);
          if (groupStages.length === 0) return null;
          const count = leads.filter((l) => {
            const sid = stageOf(l);
            return groupStages.some((s) => s.id === sid);
          }).length;
          const isCollapsed = collapsed.has(key);

          return (
            <section key={key}>
              <button
                onClick={() => toggle(key)}
                className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {label}
                <span className="chip bg-black/5 text-muted">{count}</span>
              </button>

              {!isCollapsed && (
                <div className="flex gap-4 overflow-x-auto pb-3">
                  {groupStages.map((stage) => {
                    const items = leads.filter((l) => stageOf(l) === stage.id);
                    const isOver = overStage === stage.id;
                    return (
                      <div
                        key={stage.id}
                        onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
                        onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                        onDrop={() => drop(stage.id)}
                        className="flex w-72 shrink-0 flex-col rounded-xl2 border border-line bg-black/[0.015]"
                      >
                        <div className="flex items-center justify-between px-3.5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                            <span className="text-sm font-semibold">{stage.name}</span>
                          </div>
                          <span className="chip bg-black/5 text-muted">{items.length}</span>
                        </div>

                        <div className={`min-h-[100px] flex-1 space-y-2 px-2.5 pb-3 transition-colors
                                         ${isOver ? "bg-copper-soft" : ""}`}>
                          {items.map((l) => (
                            <div
                              key={l.id}
                              draggable
                              onDragStart={() => setDragId(l.id)}
                              onDragEnd={() => { setDragId(null); setOverStage(null); }}
                              className="card cursor-grab p-3 active:cursor-grabbing"
                            >
                              <Link href={`/leads/${l.id}`} className="text-sm font-medium hover:text-copper">
                                {l.business_name}
                              </Link>
                              <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                                <span>{l.city ?? "—"}</span>
                                {!l.website && <span className="chip bg-copper-soft text-copper">target</span>}
                              </div>
                              {l.phone && (
                                <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()}
                                   className="mt-2 inline-flex items-center gap-1 text-xs text-copper hover:underline">
                                  <Phone className="h-3 w-3" />{l.phone}
                                </a>
                              )}
                            </div>
                          ))}
                          {items.length === 0 && (
                            <p className="px-2 py-6 text-center text-xs text-muted">Drop leads here</p>
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
