"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PipelineStage } from "@/lib/types";
import { Phone } from "lucide-react";

type MiniLead = {
  id: string; business_name: string; phone: string | null;
  city: string | null; status: string; stage_id: string | null; website: string | null;
};

export function KanbanBoard({ stages, leads: initial }:
  { stages: PipelineStage[]; leads: MiniLead[] }) {
  const supabase = createClient();
  const [leads, setLeads] = useState<MiniLead[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  // leads with no stage go into the first column
  const firstStage = stages[0]?.id ?? null;
  const stageOf = (l: MiniLead) => l.stage_id ?? firstStage;

  async function drop(stageId: string) {
    if (!dragId) return;
    setLeads((ls) => ls.map((l) => (l.id === dragId ? { ...l, stage_id: stageId } : l)));
    const id = dragId;
    setDragId(null); setOverStage(null);
    await supabase.from("leads").update({ stage_id: stageId }).eq("id", id);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
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

            <div className={`min-h-[120px] flex-1 space-y-2 px-2.5 pb-3 transition-colors ${isOver ? "bg-copper-soft" : ""}`}>
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
  );
}
