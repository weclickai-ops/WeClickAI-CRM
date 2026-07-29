"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays, User, Tag, Radio, Megaphone, RotateCcw, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Option = { value: string; label: string };

const RANGES: Option[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "365", label: "Last 12 months" },
];
const STATUSES: Option[] = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Called" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];
const SOURCES: Option[] = [
  { value: "", label: "All sources" },
  { value: "scraper", label: "Scraped" },
  { value: "manual", label: "Manual" },
  { value: "webhook", label: "Webhook" },
];

/**
 * One horizontal row on desktop, wrapping on narrow screens. Every control
 * writes to the query string; the server component re-reads and recalculates,
 * so what you see can never disagree with the filters.
 */
export function AnalyticsFilters({
  operators,
  campaigns,
  active,
}: {
  operators: Option[];
  campaigns: Option[];
  active: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const dirty = Boolean(active.rep || active.status || active.source || active.campaign);

  const Drop = ({ k, icon: Icon, options }: { k: string; icon: LucideIcon; options: Option[] }) => (
    <label className="relative inline-flex items-center">
      <Icon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted" />
      <select
        className="h-9 cursor-pointer appearance-none rounded-lg border border-line bg-surface pl-8 pr-7 text-[13px] text-ink outline-none transition-colors hover:border-copper/40 focus:border-copper focus:ring-2 focus:ring-copper-soft"
        value={active[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 h-3 w-3 text-muted" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5 6 8l3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </label>
  );

  return (
    <div className="sticky top-0 z-30 -mx-6 mb-5 border-b border-line bg-surface/90 px-6 py-2.5 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Drop k="range" icon={CalendarDays} options={RANGES} />
        <Drop k="rep" icon={User} options={[{ value: "", label: "All operators" }, ...operators]} />
        <Drop k="status" icon={Tag} options={STATUSES} />
        <Drop k="source" icon={Radio} options={SOURCES} />
        {campaigns.length > 0 && (
          <Drop k="campaign" icon={Megaphone} options={[{ value: "", label: "All campaigns" }, ...campaigns]} />
        )}

        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <>
              <button
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
                onClick={() => router.push(`${pathname}?range=${active.range ?? "30"}`)}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
              <span className="h-5 w-px bg-line" />
            </>
          )}
          <a
            href="/api/leads/export"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] transition-colors hover:bg-black/[0.03]"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </a>
        </div>
      </div>
    </div>
  );
}
