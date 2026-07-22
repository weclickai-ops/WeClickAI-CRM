"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Workflow } from "@/lib/types";
import { Plus, Trash2, Zap } from "lucide-react";

const TRIGGERS = [
  ["lead.created", "A new lead is created"],
  ["lead.status_changed", "A lead's status changes"],
  ["lead.assigned", "A lead is assigned"],
  ["call.logged", "A call is logged"],
];
const OPS = [["eq", "is"], ["neq", "is not"], ["contains", "contains"], ["empty", "is empty"], ["not_empty", "is not empty"]];
const FIELDS = ["status", "city", "country", "category", "website", "phone"];
const ACTION_TYPES = [
  ["set_status", "Set status"],
  ["assign", "Assign to"],
  ["move_stage", "Move to stage"],
  ["add_note", "Add a note"],
];

type Cond = { field: string; op: string; value: string };
type Action = { type: string; params: Record<string, string> };

export function WorkflowsClient({ initial, stages, team }: {
  initial: Workflow[];
  stages: { id: string; name: string }[];
  team: { id: string; full_name: string | null; email: string }[];
}) {
  const supabase = createClient();
  const [workflows, setWorkflows] = useState<Workflow[]>(initial);
  const [building, setBuilding] = useState(false);

  // builder state
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("lead.created");
  const [conds, setConds] = useState<Cond[]>([]);
  const [actions, setActions] = useState<Action[]>([{ type: "assign", params: {} }]);

  async function save() {
    if (!name.trim() || actions.length === 0) return;
    const { data, error } = await supabase.from("workflows").insert({
      name: name.trim(), trigger_event: trigger, conditions: conds, actions, active: true,
    }).select().single();
    if (error) return;
    setWorkflows([data, ...workflows]);
    setName(""); setConds([]); setActions([{ type: "assign", params: {} }]); setBuilding(false);
  }
  async function toggle(w: Workflow) {
    setWorkflows((ws) => ws.map((x) => (x.id === w.id ? { ...x, active: !x.active } : x)));
    await supabase.from("workflows").update({ active: !w.active }).eq("id", w.id);
  }
  async function remove(id: string) {
    setWorkflows((ws) => ws.filter((x) => x.id !== id));
    await supabase.from("workflows").delete().eq("id", id);
  }

  function actionValue(a: Action) {
    switch (a.type) {
      case "set_status":
        return (
          <select className="input w-40 capitalize" value={a.params.status ?? ""}
                  onChange={(e) => setActionParam(a, { status: e.target.value })}>
            <option value="">choose…</option>
            {["new","contacted","qualified","won","lost"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        );
      case "assign":
        return (
          <select className="input w-48" value={a.params.profile_id ?? ""}
                  onChange={(e) => setActionParam(a, { profile_id: e.target.value })}>
            <option value="">choose…</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
          </select>
        );
      case "move_stage":
        return (
          <select className="input w-48" value={a.params.stage_id ?? ""}
                  onChange={(e) => setActionParam(a, { stage_id: e.target.value })}>
            <option value="">choose…</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        );
      case "add_note":
        return (
          <input className="input flex-1" placeholder="Note text" value={a.params.body ?? ""}
                 onChange={(e) => setActionParam(a, { body: e.target.value })} />
        );
      default: return null;
    }
  }
  function setActionParam(a: Action, params: Record<string, string>) {
    setActions((as) => as.map((x) => (x === a ? { ...x, params: { ...x.params, ...params } } : x)));
  }

  return (
    <div className="space-y-6">
      {/* existing workflows */}
      <div className="space-y-3">
        {workflows.length === 0 && !building && (
          <div className="card px-6 py-12 text-center text-sm text-muted">No workflows yet.</div>
        )}
        {workflows.map((w) => (
          <div key={w.id} className="card flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-copper-soft">
                <Zap className="h-4 w-4 text-copper" />
              </span>
              <div>
                <p className="font-medium">{w.name}</p>
                <p className="text-xs text-muted">
                  On <strong>{w.trigger_event}</strong> · {w.conditions.length} condition(s) · {w.actions.length} action(s)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggle(w)}
                className={`chip ${w.active ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-muted"}`}>
                {w.active ? "Active" : "Paused"}
              </button>
              <button className="btn-ghost px-2" onClick={() => remove(w.id)}>
                <Trash2 className="h-4 w-4 text-muted" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* builder */}
      {building ? (
        <div className="card space-y-5 p-6">
          <div>
            <label className="label">Workflow name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="Auto-assign new Hyderabad leads to Anjli" />
          </div>

          <div>
            <label className="label">When…</label>
            <select className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="label">If all of these are true (optional)</label>
            <div className="space-y-2">
              {conds.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className="input w-36" value={c.field}
                          onChange={(e) => setConds((cs) => cs.map((x, idx) => idx === i ? { ...x, field: e.target.value } : x))}>
                    {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select className="input w-32" value={c.op}
                          onChange={(e) => setConds((cs) => cs.map((x, idx) => idx === i ? { ...x, op: e.target.value } : x))}>
                    {OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {!["empty", "not_empty"].includes(c.op) && (
                    <input className="input flex-1" value={c.value} placeholder="value"
                           onChange={(e) => setConds((cs) => cs.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
                  )}
                  <button className="btn-ghost px-2" onClick={() => setConds((cs) => cs.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-muted" />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-ghost mt-2 text-copper"
                    onClick={() => setConds((cs) => [...cs, { field: "city", op: "eq", value: "" }])}>
              <Plus className="h-4 w-4" /> Add condition
            </button>
          </div>

          <div>
            <label className="label">Then do…</label>
            <div className="space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className="input w-40" value={a.type}
                          onChange={(e) => setActions((as) => as.map((x, idx) => idx === i ? { type: e.target.value, params: {} } : x))}>
                    {ACTION_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {actionValue(a)}
                  <button className="btn-ghost px-2" onClick={() => setActions((as) => as.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-muted" />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-ghost mt-2 text-copper"
                    onClick={() => setActions((as) => [...as, { type: "add_note", params: {} }])}>
              <Plus className="h-4 w-4" /> Add action
            </button>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button className="btn-ghost" onClick={() => setBuilding(false)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Save workflow</button>
          </div>
        </div>
      ) : (
        <button className="btn-primary" onClick={() => setBuilding(true)}>
          <Plus className="h-4 w-4" /> New workflow
        </button>
      )}
    </div>
  );
}
