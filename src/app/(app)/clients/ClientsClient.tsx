"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SERVICES, PROJECT_STATUS } from "@/lib/delivery";
import {
  Search, X, SlidersHorizontal, MoreHorizontal, ExternalLink,
  Copy, Archive, Trash2, Loader2,
} from "lucide-react";

type Option = { value: string; label: string };

/** Module scope — see the note in the add-client page about remounting. */
function Drop({
  value, options, onChange,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-[13px] outline-none transition-colors hover:border-copper/40 focus:border-copper focus:ring-2 focus:ring-copper-soft"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function ClientFilters({
  managers,
  active,
}: {
  managers: Option[];
  active: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(active.q ?? "");
  const [open, setOpen] = useState(false);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const filtered = Boolean(
    active.service || active.status || active.priority || active.manager || active.pay
  );

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input h-10 pl-9"
            placeholder="Client, company, email, phone, domain, project…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && set("q", q.trim())}
            onBlur={() => set("q", q.trim())}
          />
          {q && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              onClick={() => { setQ(""); set("q", ""); }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[13px] transition-colors ${
            open || filtered ? "border-copper/50 bg-copper-soft text-copper" : "border-line bg-surface hover:bg-black/[0.02]"
          }`}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {filtered && <span className="ml-0.5 rounded-full bg-copper px-1.5 text-[11px] text-white">on</span>}
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-black/[0.012] p-2.5">
          <Drop value={active.service ?? ""} onChange={(v) => set("service", v)} options={[{ value: "", label: "All services" }, ...SERVICES.map((s) => ({ value: s, label: s }))]} />
          <Drop
            value={active.status ?? ""}
            onChange={(v) => set("status", v)}
            options={[
              { value: "", label: "All statuses" },
              ...Object.entries(PROJECT_STATUS).map(([v, m]) => ({ value: v, label: m.label })),
            ]}
          />
          <Drop
            value={active.priority ?? ""}
            onChange={(v) => set("priority", v)}
            options={[
              { value: "", label: "Any priority" },
              { value: "urgent", label: "Urgent" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <Drop value={active.manager ?? ""} onChange={(v) => set("manager", v)} options={[{ value: "", label: "Anyone" }, ...managers]} />
          <Drop
            value={active.pay ?? ""}
            onChange={(v) => set("pay", v)}
            options={[
              { value: "", label: "Any payment" },
              { value: "outstanding", label: "Money outstanding" },
              { value: "clear", label: "Fully paid" },
            ]}
          />
          {filtered && (
            <button
              className="inline-flex h-9 items-center gap-1.5 px-2 text-[13px] text-muted hover:text-ink"
              onClick={() => { setQ(""); router.push(pathname); }}
            >
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ClientRowActions({ id, company }: { id: string; company: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function archive() {
    setBusy(true);
    await supabase.from("clients").update({ status: "completed" }).eq("id", id);
    setBusy(false); setOpen(false);
    router.refresh();
  }

  async function duplicate() {
    setBusy(true);
    const { data } = await supabase.from("clients").select("*").eq("id", id).single();
    if (data) {
      const { id: _drop, created_at, updated_at, ...rest } = data as any;
      await supabase.from("clients").insert({ ...rest, company_name: `${rest.company_name} (copy)` });
    }
    setBusy(false); setOpen(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    setBusy(false);
    if (!error) { setOpen(false); setConfirming(false); router.refresh(); }
  }

  return (
    <div className="relative">
      <button className="btn-ghost px-2 py-1.5" onClick={() => setOpen((v) => !v)} title="Actions">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : <MoreHorizontal className="h-4 w-4 text-muted" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setConfirming(false); }} />
          <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
            <Link href={`/clients/${id}`} className="flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-black/[0.03]">
              <ExternalLink className="h-3.5 w-3.5 text-muted" /> Open workspace
            </Link>
            <button onClick={duplicate} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-black/[0.03]">
              <Copy className="h-3.5 w-3.5 text-muted" /> Duplicate
            </button>
            <button onClick={archive} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-black/[0.03]">
              <Archive className="h-3.5 w-3.5 text-muted" /> Mark completed
            </button>
            <div className="my-1 h-px bg-line" />
            {confirming ? (
              <div className="px-3 py-2">
                <p className="text-[12px] leading-snug text-muted">
                  Deletes {company} and every project, task and note on it.
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button className="btn-danger px-2 py-1 text-xs" onClick={remove} disabled={busy}>Delete</button>
                  <button className="btn-ghost px-2 py-1 text-xs text-muted" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
