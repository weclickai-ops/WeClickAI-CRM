"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { timeAgo } from "@/lib/utils";
import type { LeadFilters } from "@/lib/leads/export";
import type { Lead, PipelineStage, Profile } from "@/lib/types";
import { LeadDrawer } from "./LeadDrawer";
import { Phone, Globe, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

/**
 * The table moved to a client component so rows can be ticked. Selection is what
 * makes "export these three" possible; the server page still does the fetching.
 */
export function LeadsTable({
  leads, teamMap, filters, filteredCount, totalCount, page, pageSize,
  stages = [], team = [],
}: {
  leads: Lead[];
  teamMap: Record<string, string>;
  filters: LeadFilters;
  filteredCount: number;
  totalCount: number;
  page: number;
  pageSize: number;
  stages?: PipelineStage[];
  team?: Pick<Profile, "id" | "full_name" | "email">[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // Clicking a row opens a panel rather than navigating, so your filters and
  // scroll position survive — which matters when working down a call list.
  const [openId, setOpenId] = useState<string | null>(null);
  const openLead = leads.find((l) => l.id === openId) ?? null;

  const lastPage = Math.max(1, Math.ceil(filteredCount / pageSize));
  const first = filteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, filteredCount);
  const allOnPage = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const exportCount = selected.size > 0 ? selected.size : filteredCount;

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAllOnPage() {
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPage) leads.forEach((l) => n.delete(l.id));
      else leads.forEach((l) => n.add(l.id));
      return n;
    });
  }
  function goToPage(p: number) {
    const next = new URLSearchParams(params.toString());
    p <= 1 ? next.delete("page") : next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  async function exportCsv() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/leads/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Ticked rows win; otherwise the whole filtered set, every page of it.
        body: JSON.stringify(
          selected.size > 0 ? { ids: [...selected] } : { filters }
        ),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "The export failed." }));
        setNote({ ok: false, text: error });
        return;
      }

      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "leads.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);

      const count = res.headers.get("X-Row-Count");
      const cut = res.headers.get("X-Truncated") === "true";
      setNote({
        ok: !cut,
        text: cut
          ? `Downloaded the first ${count} leads — narrow the filters to get the rest.`
          : `Downloaded ${count} lead${count === "1" ? "" : "s"}.`,
      });
    } catch {
      setNote({ ok: false, text: "Couldn't reach the server. Check your connection and retry." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {filteredCount === 0 ? "No leads match these filters" : (
            <>
              Showing <span className="text-ink">{first.toLocaleString("en-IN")}–{last.toLocaleString("en-IN")}</span>{" "}
              of {filteredCount.toLocaleString("en-IN")}
              {filteredCount !== totalCount && <> filtered from {totalCount.toLocaleString("en-IN")}</>}
            </>
          )}
          {selected.size > 0 && (
            <>
              {" · "}<span className="text-copper">{selected.size} selected</span>{" "}
              <button onClick={() => setSelected(new Set())} className="underline hover:text-ink">clear</button>
            </>
          )}
        </p>

        <button className="btn-outline text-sm" onClick={exportCsv} disabled={busy || exportCount === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
          <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs tabular-nums">
            {exportCount.toLocaleString("en-IN")}
          </span>
        </button>
      </div>

      {note && (
        <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm ${
          note.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {note.text}
        </p>
      )}

      <div className="card overflow-hidden">
        {leads.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted">No leads match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line">
                <th className="th w-10">
                  <input type="checkbox" className="h-4 w-4 accent-copper"
                         checked={allOnPage} onChange={toggleAllOnPage}
                         aria-label="Select every lead on this page" />
                </th>
                <th className="th">Business</th><th className="th">Phone</th>
                <th className="th">Location</th><th className="th">Website</th>
                <th className="th">Status</th><th className="th">Owner</th><th className="th">Added</th>
              </tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className={`border-b border-line last:border-0 hover:bg-black/[0.015]
                                             ${selected.has(l.id) ? "bg-copper-soft/40" : ""}`}>
                    <td className="td">
                      <input type="checkbox" className="h-4 w-4 accent-copper"
                             checked={selected.has(l.id)} onChange={() => toggle(l.id)}
                             aria-label={`Select ${l.business_name}`} />
                    </td>
                    <td className="td font-medium">
                      <button onClick={() => setOpenId(l.id)}
                              className="text-left hover:text-copper">
                        {l.business_name}
                      </button>
                      {l.category && <span className="ml-2 text-xs text-muted">{l.category.replaceAll("_", " ")}</span>}
                    </td>
                    <td className="td">
                      {l.phone ? (
                        <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 text-ink hover:text-copper">
                          <Phone className="h-3.5 w-3.5" />{l.phone}
                        </a>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="td text-muted">{l.city ?? "—"}</td>
                    <td className="td">
                      {l.website ? (
                        <a href={l.website} target="_blank" rel="noreferrer"
                           className="inline-flex items-center gap-1 text-muted hover:text-copper">
                          <Globe className="h-3.5 w-3.5" />site
                        </a>
                      ) : <span className="chip bg-copper-soft text-copper">target</span>}
                    </td>
                    <td className="td"><StatusBadge status={l.status} /></td>
                    <td className="td text-muted">{l.assigned_to ? teamMap[l.assigned_to] ?? "—" : "—"}</td>
                    <td className="td text-muted">{timeAgo(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openLead && (
        <LeadDrawer
          lead={openLead}
          stages={stages}
          team={team}
          onClose={() => setOpenId(null)}
        />
      )}

      {lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1}
                  className="btn-outline text-sm disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-sm text-muted">Page {page} of {lastPage}</span>
          <button onClick={() => goToPage(page + 1)} disabled={page >= lastPage}
                  className="btn-outline text-sm disabled:opacity-40">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
