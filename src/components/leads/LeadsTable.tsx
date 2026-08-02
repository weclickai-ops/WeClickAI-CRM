"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { timeAgo } from "@/lib/utils";
import type { LeadFilters } from "@/lib/leads/export";
import type { Lead, PipelineStage, Profile } from "@/lib/types";
import { LeadDrawer } from "./LeadDrawer";
import {
  Phone, Globe, ChevronLeft, ChevronRight, Download, Loader2,
  UserPlus, CalendarClock, Check, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Days from today. 0 means due today, which is the point of the first one. */
const BULK_FOLLOWUPS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  const [assignOpen, setAssignOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const supabase = createClient();
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

  /**
   * Assign every ticked lead in one update. Splitting 50 leads across the team
   * one row at a time is the job this replaces.
   */
  async function bulkAssign(userId: string | null) {
    if (selected.size === 0) return;
    setBusy(true);
    setNote(null);
    const ids = [...selected];
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: userId })
      .in("id", ids);
    setBusy(false);
    setAssignOpen(false);
    if (error) {
      setNote({ ok: false, text: error.message });
      return;
    }
    const who = userId ? (team.find((t) => t.id === userId)?.full_name ?? "that person") : "nobody";
    setNote({ ok: true, text: `${ids.length} lead${ids.length === 1 ? "" : "s"} assigned to ${who}.` });
    setSelected(new Set());
    router.refresh();
  }

  /** Schedule a follow-up on every ticked lead at once. */
  async function bulkFollowUp(days: number) {
    if (selected.size === 0) return;
    setBusy(true);
    setNote(null);
    const d = new Date();
    d.setDate(d.getDate() + days);
    const ids = [...selected];
    const { error } = await supabase
      .from("leads")
      .update({ followups_enabled: true, next_followup_at: ymd(d) })
      .in("id", ids);
    setBusy(false);
    setFollowOpen(false);
    if (error) {
      setNote({ ok: false, text: error.message });
      return;
    }
    setNote({
      ok: true,
      text: `${ids.length} lead${ids.length === 1 ? "" : "s"} due ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}.`,
    });
    setSelected(new Set());
    router.refresh();
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

        <div className="flex flex-wrap items-center gap-2">
        {selected.size > 0 && (
          <>
            <div className="relative">
              <button className="btn-outline text-sm" onClick={() => { setAssignOpen((v) => !v); setFollowOpen(false); }}
                      disabled={busy}>
                <UserPlus className="h-4 w-4" /> Assign
              </button>
              {assignOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAssignOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
                    <p className="px-3 py-1.5 text-[11px] text-muted">
                      Assign {selected.size} lead{selected.size === 1 ? "" : "s"} to
                    </p>
                    {team.map((t) => (
                      <button key={t.id} onClick={() => bulkAssign(t.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-black/[0.03]">
                        <Check className="h-3.5 w-3.5 text-transparent" />
                        {t.full_name ?? t.email}
                      </button>
                    ))}
                    <div className="my-1 h-px bg-line" />
                    <button onClick={() => bulkAssign(null)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-muted hover:bg-black/[0.03]">
                      <X className="h-3.5 w-3.5" /> Unassign
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button className="btn-outline text-sm" onClick={() => { setFollowOpen((v) => !v); setAssignOpen(false); }}
                      disabled={busy}>
                <CalendarClock className="h-4 w-4" /> Follow up
              </button>
              {followOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFollowOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
                    <p className="px-3 py-1.5 text-[11px] text-muted">
                      Schedule {selected.size} lead{selected.size === 1 ? "" : "s"}
                    </p>
                    {BULK_FOLLOWUPS.map((q) => (
                      <button key={q.label} onClick={() => bulkFollowUp(q.days)}
                              className="block w-full px-3 py-2 text-left text-[13px] hover:bg-black/[0.03]">
                        {q.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <button className="btn-outline text-sm" onClick={exportCsv} disabled={busy || exportCount === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
          <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs tabular-nums">
            {exportCount.toLocaleString("en-IN")}
          </span>
        </button>
        </div>
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
            <table className="group/table w-full">
              <thead><tr className="border-b border-line">
                <th className="th w-10">
                  <input type="checkbox"
                         className={`h-4 w-4 accent-copper transition-opacity
                                     ${selected.size > 0 ? "opacity-100" : "opacity-0 focus:opacity-100"}
                                     group-hover/table:opacity-100`}
                         checked={allOnPage} onChange={toggleAllOnPage}
                         aria-label="Select every lead on this page" />
                </th>
                <th className="th">Business</th><th className="th">Phone</th>
                <th className="th">Location</th><th className="th">Website</th>
                <th className="th">Status</th><th className="th">Owner</th><th className="th">Added</th>
              </tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className={`group/row border-b border-line last:border-0 hover:bg-black/[0.015]
                                             ${selected.has(l.id) ? "bg-copper-soft/40" : ""}`}>
                    <td className="td">
                      <input type="checkbox"
                             className={`h-4 w-4 accent-copper transition-opacity
                                         ${selected.has(l.id) || selected.size > 0
                                           ? "opacity-100"
                                           : "opacity-0 focus:opacity-100 group-hover/row:opacity-100"}`}
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
