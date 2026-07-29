"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/lib/utils";
import { Activity, ChevronRight, X } from "lucide-react";

/**
 * Tab shell. Every panel is rendered on the server and handed down as a
 * child — only visibility switches on the client, so there's no second
 * fetch and no chance of a panel disagreeing with the filters.
 */
export function Tabs({
  tabs,
  children,
  fixedHeight,
}: {
  tabs: string[];
  children: ReactNode[];
  fixedHeight?: number;
}) {
  const [i, setI] = useState(0);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t, idx) => (
          <button
            key={t}
            onClick={() => setI(idx)}
            className={cx(
              "relative shrink-0 px-3 py-2 text-[13px] font-medium transition-colors",
              idx === i ? "text-copper" : "text-muted hover:text-ink"
            )}
          >
            {t}
            {idx === i && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-copper" />
            )}
          </button>
        ))}
      </div>
      <div
        className="pt-4"
        style={fixedHeight ? { minHeight: fixedHeight } : undefined}
      >
        {children[i]}
      </div>
    </div>
  );
}

export type ActivityItem = {
  at: string;
  who: string;
  what: string;
  tag: string;
  good: boolean;
};

/**
 * Sticky right rail on wide screens, slide-over below 1280px. Collapsible,
 * because 280px is real estate the funnel would otherwise use.
 */
export function ActivityRail({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);

  const list = (
    <ul className="space-y-3">
      {items.length === 0 && (
        <li className="text-[13px] text-muted">Nothing logged in this window.</li>
      )}
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            className={cx(
              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
              t.good ? "bg-emerald-500" : "bg-black/20"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug">
              <span className="font-medium">{t.who}</span> {t.what}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {t.at}
              {t.tag && <span className="ml-1.5">· {t.tag}</span>}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* wide screens — sticky column */}
      <aside className="hidden w-[280px] shrink-0 2xl:block">
        <div className="sticky top-[72px]">
          <div className="card p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted" />
              <p className="text-[14px] font-medium">Recent activity</p>
            </div>
            <div className="mt-3 max-h-[calc(100vh-190px)] overflow-y-auto pr-1">{list}</div>
          </div>
        </div>
      </aside>

      {/* narrow screens — trigger + slide-over */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2.5 text-[13px] shadow-lg transition-transform hover:-translate-y-0.5 2xl:hidden"
      >
        <Activity className="h-4 w-4 text-copper" /> Activity
        <ChevronRight className="h-3.5 w-3.5 text-muted" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 2xl:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[320px] max-w-[86vw] overflow-y-auto border-l border-line bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="font-display text-[16px] font-semibold">Recent activity</p>
              <button className="btn-ghost px-2 py-1" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-muted" />
              </button>
            </div>
            <div className="mt-4">{list}</div>
          </div>
        </div>
      )}
    </>
  );
}
