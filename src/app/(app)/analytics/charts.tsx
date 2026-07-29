import { cx } from "@/lib/utils";

/** All charts here are hand-drawn SVG so the CRM keeps its four dependencies. */

export function Donut({
  slices,
  total,
  centreLabel,
}: {
  slices: { label: string; n: number; color: string; href?: string }[];
  total: number;
  centreLabel?: string;
}) {
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="18" />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.n / total) * C;
            const el = (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>

      <div className="min-w-0 flex-1 space-y-1.5">
        {centreLabel && (
          <p className="font-display text-xl font-semibold">{centreLabel}</p>
        )}
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 truncate text-muted">{s.label}</span>
            <span className="tabular-nums font-medium">{s.n}</span>
            <span className="w-10 text-right tabular-nums text-xs text-muted">
              {total ? Math.round((s.n / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Bars({
  data,
  format,
  height = 90,
}: {
  data: { label: string; n: number }[];
  format?: (n: number) => string;
  height?: number;
}) {
  const peak = Math.max(1, ...data.map((d) => d.n));
  const w = 100 / Math.max(data.length, 1);

  return (
    <div className="mt-3">
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="group relative flex-1"
            style={{ minWidth: `${w}%` }}
            title={`${d.label}: ${format ? format(d.n) : d.n}`}
          >
            <div
              className={cx(
                "w-full rounded-t transition-all",
                i === data.length - 1 ? "bg-copper" : "bg-black/[0.16] group-hover:bg-black/30"
              )}
              style={{ height: Math.max((d.n / peak) * height, d.n > 0 ? 3 : 1) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function StatBar({
  label,
  n,
  of,
  tone = "bg-copper",
  suffix,
}: {
  label: string;
  n: number;
  of: number;
  tone?: string;
  suffix?: string;
}) {
  const p = of ? Math.round((n / of) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium">{n}</span>
          <span className="ml-2 text-muted">{p}%{suffix}</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div className={cx("h-full rounded-full transition-all", tone)} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/** Calls by weekday × hour. Darker = busier. */
export function HeatMap({ grid }: { grid: number[][] }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const peak = Math.max(1, ...grid.flat());

  return (
    <div className="mt-3 overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="ml-9 flex">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {grid.map((row, d) => (
          <div key={d} className="mt-[2px] flex items-center">
            <div className="w-9 text-[10px] text-muted">{days[d]}</div>
            {row.map((n, h) => (
              <div
                key={h}
                title={`${days[d]} ${h}:00 — ${n} call${n === 1 ? "" : "s"}`}
                className="mx-[1px] h-4 flex-1 rounded-[2px]"
                style={{
                  background:
                    n === 0 ? "rgba(0,0,0,0.04)" : `rgba(184,115,51,${0.18 + (n / peak) * 0.82})`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
