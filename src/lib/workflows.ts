/* =====================================================================
   Workflow rules engine.
   A workflow = trigger + conditions + actions.
     trigger:    lead.created | lead.status_changed | lead.assigned | call.logged
     conditions: [{ field, op, value }]  (ALL must pass — AND logic)
     actions:    [{ type, params }]
   Supported actions (server-side, no external deps required):
     - set_status   { status }
     - assign       { profile_id }
     - move_stage   { stage_id }
     - add_note     { body }
   This runs against the SERVICE-ROLE client so it can act without a
   user session (e.g. right after the scraper inserts a lead).
   ===================================================================== */
import type { SupabaseClient } from "@supabase/supabase-js";

type Cond = { field: string; op: string; value: string };
type Action = { type: string; params: Record<string, string> };

function get(obj: any, path: string) {
  if (path.startsWith("custom.")) return obj?.custom_data?.[path.slice(7)];
  return obj?.[path];
}

function passes(cond: Cond, lead: any): boolean {
  const actual = get(lead, cond.field);
  const a = actual == null ? "" : String(actual).toLowerCase();
  const b = (cond.value ?? "").toLowerCase();
  switch (cond.op) {
    case "eq":        return a === b;
    case "neq":       return a !== b;
    case "contains":  return a.includes(b);
    case "empty":     return a === "";
    case "not_empty": return a !== "";
    default:          return false;
  }
}

export async function runWorkflows(
  sb: SupabaseClient,
  event: string,
  lead: any
) {
  const { data: workflows } = await sb
    .from("workflows")
    .select("*")
    .eq("trigger_event", event)
    .eq("active", true);

  if (!workflows?.length) return;

  for (const wf of workflows) {
    const conds: Cond[] = wf.conditions ?? [];
    const ok = conds.every((c) => passes(c, lead));
    if (!ok) {
      await sb.from("workflow_runs").insert({
        workflow_id: wf.id, lead_id: lead.id, status: "skipped",
        detail: "conditions not met",
      });
      continue;
    }

    try {
      for (const action of (wf.actions ?? []) as Action[]) {
        await applyAction(sb, action, lead);
      }
      await sb.from("workflow_runs").insert({
        workflow_id: wf.id, lead_id: lead.id, status: "success",
        detail: `${(wf.actions ?? []).length} action(s) applied`,
      });
    } catch (e: any) {
      await sb.from("workflow_runs").insert({
        workflow_id: wf.id, lead_id: lead.id, status: "error",
        detail: e?.message ?? "unknown error",
      });
    }
  }
}

async function applyAction(sb: SupabaseClient, action: Action, lead: any) {
  const p = action.params ?? {};
  switch (action.type) {
    case "set_status":
      await sb.from("leads").update({ status: p.status }).eq("id", lead.id);
      break;
    case "assign":
      await sb.from("leads").update({ assigned_to: p.profile_id }).eq("id", lead.id);
      break;
    case "move_stage":
      await sb.from("leads").update({ stage_id: p.stage_id }).eq("id", lead.id);
      break;
    case "add_note":
      await sb.from("lead_notes").insert({ lead_id: lead.id, body: p.body });
      break;
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}
