"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import type { Campaign } from "@/lib/types";

export function LeadFilters({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="input pl-9"
          placeholder="Search business, phone, city…"
          defaultValue={params.get("q") ?? ""}
          onKeyDown={(e) => { if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value); }}
        />
      </div>

      <select className="input w-auto" defaultValue={params.get("status") ?? ""}
              onChange={(e) => set("status", e.target.value)}>
        <option value="">All statuses</option>
        {["new", "contacted", "qualified", "won", "lost"].map((s) =>
          <option key={s} value={s} className="capitalize">{s}</option>)}
      </select>

      <select className="input w-auto" defaultValue={params.get("website") ?? ""}
              onChange={(e) => set("website", e.target.value)}>
        <option value="">Any website state</option>
        <option value="none">No website (targets)</option>
        <option value="has">Has website</option>
      </select>

      <select className="input w-auto" defaultValue={params.get("campaign") ?? ""}
              onChange={(e) => set("campaign", e.target.value)}>
        <option value="">All campaigns</option>
        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}
