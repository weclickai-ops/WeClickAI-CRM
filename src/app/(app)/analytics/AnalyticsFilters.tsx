"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Filter, X } from "lucide-react";

type Option = { value: string; label: string };

/**
 * Sticky filter bar. Every control writes to the query string and lets the
 * server component re-read the numbers — no client-side data handling, so the
 * filters can never disagree with what's rendered.
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
    { value: "manual", label: "Added by hand" },
    { value: "webhook", label: "Webhook" },
  ];

  const dirty = Object.entries(active).some(([k, v]) => v && k !== "range");

  const Select = ({ k, options }: { k: string; options: Option[] }) => (
    <select
      className="input h-9 min-w-[9rem] py-0 text-sm"
      value={active[k] ?? ""}
      onChange={(e) => set(k, e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );

  return (
    <div className="sticky top-0 z-20 -mx-6 mb-5 border-b border-line bg-surface/95 px-6 py-3 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 shrink-0 text-muted" />
        <Select k="range" options={RANGES} />
        <Select
          k="rep"
          options={[{ value: "", label: "All operators" }, ...operators]}
        />
        <Select k="status" options={STATUSES} />
        <Select k="source" options={SOURCES} />
        {campaigns.length > 0 && (
          <Select
            k="campaign"
            options={[{ value: "", label: "All campaigns" }, ...campaigns]}
          />
        )}
        {dirty && (
          <button
            className="btn-ghost h-9 px-2.5 text-sm text-muted"
            onClick={() => router.push(`${pathname}?range=${active.range ?? "30"}`)}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
