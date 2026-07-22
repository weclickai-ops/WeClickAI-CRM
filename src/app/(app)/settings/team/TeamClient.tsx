"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import type { Profile, Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "manager", "agent"];
const ROLE_HELP: Record<Role, string> = {
  admin: "Full access, including team & settings.",
  manager: "Everything except managing the team.",
  agent: "Works leads, campaigns, invoices.",
};

export function TeamClient({ team: initial, meId }: { team: Profile[]; meId: string }) {
  const supabase = createClient();
  const [team, setTeam] = useState(initial);

  async function setRole(id: string, role: Role) {
    setTeam((t) => t.map((p) => (p.id === id ? { ...p, role } : p)));
    await supabase.from("profiles").update({ role }).eq("id", id);
  }
  async function toggleActive(id: string, active: boolean) {
    setTeam((t) => t.map((p) => (p.id === id ? { ...p, active } : p)));
    await supabase.from("profiles").update({ active }).eq("id", id);
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead><tr className="border-b border-line">
          <th className="th">Member</th><th className="th">Role</th><th className="th">Status</th>
        </tr></thead>
        <tbody>
          {team.map((p) => (
            <tr key={p.id} className="border-b border-line last:border-0">
              <td className="td">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-charcoal text-sm font-semibold text-white">
                    {initials(p.full_name, p.email)}
                  </div>
                  <div>
                    <p className="font-medium">{p.full_name ?? "—"} {p.id === meId && <span className="text-xs text-muted">(you)</span>}</p>
                    <p className="text-xs text-muted">{p.email}</p>
                  </div>
                </div>
              </td>
              <td className="td">
                <select className="input w-40 capitalize" value={p.role}
                        disabled={p.id === meId}
                        onChange={(e) => setRole(p.id, e.target.value as Role)}>
                  {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">{ROLE_HELP[p.role]}</p>
              </td>
              <td className="td">
                <button
                  onClick={() => toggleActive(p.id, !p.active)}
                  disabled={p.id === meId}
                  className={`chip ${p.active ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-muted"}`}>
                  {p.active ? "Active" : "Disabled"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
