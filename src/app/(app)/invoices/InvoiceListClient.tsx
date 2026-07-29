"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, X, Trash2, Loader2, FileDown, Eye } from "lucide-react";
import Link from "next/link";

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Pending" },
  { value: "partially_paid", label: "Part paid" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const RANGES = [
  { value: "", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export function InvoiceFilters({ active }: { active: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(active.q ?? "");

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const dirty = Boolean(active.q || active.status || active.range);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[15rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="input h-9 pl-9 text-sm"
          placeholder="Invoice number or client…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && set("q", q.trim())}
          onBlur={() => set("q", q.trim())}
        />
      </div>
      <select
        className="input h-9 min-w-[9rem] py-0 text-sm"
        value={active.status ?? ""}
        onChange={(e) => set("status", e.target.value)}
      >
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <select
        className="input h-9 min-w-[9rem] py-0 text-sm"
        value={active.range ?? ""}
        onChange={(e) => set("range", e.target.value)}
      >
        {RANGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {dirty && (
        <button className="btn-ghost h-9 px-2.5 text-sm text-muted" onClick={() => { setQ(""); router.push(pathname); }}>
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}

export function InvoiceRowActions({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    setBusy(false);
    setConfirming(false);
    if (!error) router.refresh();
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button className="btn-danger px-2.5 py-1.5 text-xs" onClick={remove} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
        </button>
        <button className="btn-ghost px-2 py-1.5 text-xs text-muted" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Link href={`/invoices/${id}`} className="btn-ghost px-2 py-1.5" title={`View ${number}`}>
        <Eye className="h-4 w-4 text-muted" />
      </Link>
      <Link href={`/invoices/${id}?print=1`} className="btn-ghost px-2 py-1.5" title="Download PDF">
        <FileDown className="h-4 w-4 text-muted" />
      </Link>
      <button className="btn-ghost px-2 py-1.5" onClick={() => setConfirming(true)} title="Delete">
        <Trash2 className="h-4 w-4 text-muted" />
      </button>
    </span>
  );
}
