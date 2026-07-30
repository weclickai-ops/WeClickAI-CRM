"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_STATUS, PRIORITY, SERVICES, daysUntil, projectHealth, HEALTH } from "@/lib/delivery";
import { money, cx } from "@/lib/utils";
import type { Project, Profile, ProjectStatus, WorkPriority } from "@/lib/types";
import { Plus, Loader2, Check, X, Trash2, Save } from "lucide-react";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Completion ring — the one big number for the whole engagement. */
export function CompletionRing({ pct, size = 132 }: { pct: number; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--copper)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          className="transition-[stroke-dasharray] duration-1000"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-display text-[26px] font-semibold leading-none tabular-nums">{pct}%</p>
          <p className="mt-0.5 text-[11px] text-muted">complete</p>
        </div>
      </div>
    </div>
  );
}

/** One editable project card. Status and progress change constantly, so they're
 *  inline rather than behind an edit screen. */
export function ProjectCard({
  project,
  team,
  overdueMoney,
}: {
  project: Project;
  team: Profile[];
  overdueMoney: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [p, setP] = useState(project);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const st = PROJECT_STATUS[p.status];
  const left = daysUntil(p.delivery_date);
  const h = HEALTH[projectHealth(p, { overdueMoney })];
  const owner = team.find((t) => t.id === p.owner);

  function edit(patch: Partial<Project>) {
    setP({ ...p, ...patch });
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    await supabase.from("projects").update({
      name: p.name, service: p.service, status: p.status, priority: p.priority,
      progress: p.progress, start_date: p.start_date, delivery_date: p.delivery_date,
      owner: p.owner, budget: p.budget,
      completed_on: p.status === "completed" ? (p.completed_on ?? ymd(new Date())) : null,
    }).eq("id", p.id);
    setBusy(false);
    setDirty(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await supabase.from("projects").delete().eq("id", p.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            className="w-full truncate border-0 bg-transparent p-0 font-display text-[15px] font-semibold outline-none focus:ring-0"
            value={p.name}
            onChange={(e) => edit({ name: e.target.value })}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cx("chip", st.cls)}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
              {st.label}
            </span>
            <span className={cx("text-[11px]", PRIORITY[p.priority].cls)}>
              {PRIORITY[p.priority].label}
            </span>
            <span className={cx("inline-flex items-center gap-1 text-[11px]", h.cls)}>
              <span className={cx("h-1.5 w-1.5 rounded-full", h.bar)} /> {h.label}
            </span>
          </div>
        </div>

        {confirming ? (
          <span className="flex shrink-0 gap-1.5">
            <button className="btn-danger px-2 py-1 text-xs" onClick={remove} disabled={busy}>Delete</button>
            <button className="btn-ghost px-2 py-1 text-xs text-muted" onClick={() => setConfirming(false)}>Cancel</button>
          </span>
        ) : (
          <button className="btn-ghost shrink-0 px-2 py-1" onClick={() => setConfirming(true)} title="Delete project">
            <Trash2 className="h-3.5 w-3.5 text-muted" />
          </button>
        )}
      </div>

      {/* progress */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="text-muted">Progress</span>
          <span className="font-medium tabular-nums">{p.progress}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={5}
          value={p.progress}
          onChange={(e) => edit({ progress: Number(e.target.value) })}
          className="mt-1.5 w-full accent-copper"
        />
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <div>
          <label className="label">Service</label>
          <select className="input py-1.5 text-[13px]" value={p.service} onChange={(e) => edit({ service: e.target.value })}>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input py-1.5 text-[13px]" value={p.status}
                  onChange={(e) => edit({ status: e.target.value as ProjectStatus })}>
            {Object.entries(PROJECT_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Delivery date</label>
          <input type="date" className="input py-1.5 text-[13px]" value={p.delivery_date ?? ""}
                 onChange={(e) => edit({ delivery_date: e.target.value })} />
          {left !== null && p.status !== "completed" && (
            <p className={cx("mt-1 text-[11px]", left < 0 ? "text-red-600" : left <= 7 ? "text-amber-700" : "text-muted")}>
              {left < 0 ? `${Math.abs(left)} days overdue` : left === 0 ? "due today" : `${left} days left`}
            </p>
          )}
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input py-1.5 text-[13px]" value={p.priority}
                  onChange={(e) => edit({ priority: e.target.value as WorkPriority })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input py-1.5 text-[13px]" value={p.owner ?? ""}
                  onChange={(e) => edit({ owner: e.target.value || null })}>
            <option value="">Unassigned</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Budget</label>
          <input className="input py-1.5 text-[13px]" inputMode="decimal" value={p.budget}
                 onChange={(e) => edit({ budget: Number(e.target.value) || 0 })} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted">
          {owner ? `${owner.full_name ?? owner.email} · ` : ""}{money(Number(p.budget))}
        </span>
        {dirty && (
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        )}
      </div>
    </div>
  );
}

export function AddProject({ clientId, team }: { clientId: string; team: Profile[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    service: SERVICES[0], name: "",
    delivery_date: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return ymd(d); })(),
    budget: "", owner: "",
  });

  async function add() {
    setBusy(true);
    await supabase.from("projects").insert({
      client_id: clientId,
      name: f.name.trim() || f.service,
      service: f.service,
      status: "planning",
      start_date: ymd(new Date()),
      delivery_date: f.delivery_date || null,
      budget: Number(f.budget) || 0,
      owner: f.owner || null,
    });
    setBusy(false); setOpen(false);
    setF({ ...f, name: "", budget: "" });
    router.refresh();
  }

  if (!open) {
    return (
      <button className="card flex min-h-[140px] w-full flex-col items-center justify-center gap-2 border-dashed p-5 text-muted transition-colors hover:border-copper/40 hover:text-copper"
              onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5" />
        <span className="text-[13px]">Add a project</span>
      </button>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium">New project</p>
        <button className="btn-ghost px-1.5 py-1" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5 text-muted" />
        </button>
      </div>
      <div className="mt-3 space-y-2.5">
        <div>
          <label className="label">Service</label>
          <select className="input py-1.5 text-[13px]" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input py-1.5 text-[13px]" placeholder={f.service} value={f.name}
                 onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="label">Delivery</label>
            <input type="date" className="input py-1.5 text-[13px]" value={f.delivery_date}
                   onChange={(e) => setF({ ...f, delivery_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Budget</label>
            <input className="input py-1.5 text-[13px]" inputMode="decimal" value={f.budget}
                   onChange={(e) => setF({ ...f, budget: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input py-1.5 text-[13px]" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
            <option value="">Unassigned</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
          </select>
        </div>
        <button className="btn-primary w-full text-sm" onClick={add} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Create project
        </button>
      </div>
    </div>
  );
}

/** Notes plus a quick way to log something to the activity feed. */
export function NotesAndLog({
  clientId,
  internal,
  clientFacing,
}: {
  clientId: string;
  internal: string | null;
  clientFacing: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<"internal" | "client">("internal");
  const [a, setA] = useState(internal ?? "");
  const [b, setB] = useState(clientFacing ?? "");
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveNotes() {
    setBusy(true);
    await supabase.from("clients")
      .update({ notes_internal: a || null, notes_client: b || null })
      .eq("id", clientId);
    setBusy(false); setSaved(true);
    router.refresh();
  }

  async function addLog() {
    if (!log.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("client_activity").insert({
      client_id: clientId, kind: "note", summary: log.trim(), actor: user?.id ?? null,
    });
    setBusy(false); setLog("");
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="flex gap-1 border-b border-line">
        {(["internal", "client"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={cx("relative px-3 py-2 text-[13px] font-medium transition-colors",
                                tab === t ? "text-copper" : "text-muted hover:text-ink")}>
            {t === "internal" ? "Internal notes" : "Client notes"}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-copper" />}
          </button>
        ))}
      </div>

      <textarea
        className="input mt-3 min-h-[120px]"
        placeholder={tab === "internal" ? "Only your team sees this." : "Things you'd happily show the client."}
        value={tab === "internal" ? a : b}
        onChange={(e) => { tab === "internal" ? setA(e.target.value) : setB(e.target.value); setSaved(false); }}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {saved && <span className="chip bg-emerald-100 text-[11px] text-emerald-800">Saved</span>}
        <button className="btn-outline text-sm" onClick={saveNotes} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save notes
        </button>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <label className="label">Log an update</label>
        <div className="mt-1 flex gap-2">
          <input
            className="input" placeholder="Homepage approved, waiting on content…"
            value={log} onChange={(e) => setLog(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLog()}
          />
          <button className="btn-primary shrink-0 px-3" onClick={addLog} disabled={busy || !log.trim()}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Appears in the activity feed and on the clients list.</p>
      </div>
    </div>
  );
}
