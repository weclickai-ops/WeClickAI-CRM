import { cx } from "@/lib/utils";

/* Hand-drawn SVG throughout — the CRM keeps its four dependencies. */

export const TONE = {
  leads: "#FF6200",
  calls: "#3B82F6",
  won: "#16A34A",
  lost: "#E5484D",
  muted: "#8A8F98",
};

/* ---------------------------------------------------------------- funnel */

export function Funnel({
  stages,
}: {
  stages: { label: string; n: number }[];
}) {
  const top = stages[0]?.n || 1;

  return (
    <div className="space-y-3.5">
      {stages.map((s, i) => {
        const share = Math.round((s.n / top) * 100);
        const prev = i === 0 ? s.n : stages[i - 1].n;
        const drop = prev > 0 ? Math.round(((prev - s.n) / prev) * 100) : 0;
        // one ramp, lightening down the funnel — not five competing hues
        const alpha = 1 - i * 0.13;
        return (
          <div key={s.label} className="group">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium">{s.label}</span>
              <span className="flex items-baseline gap-2 tabular-nums">
                {i > 0 && drop > 0 && (
                  <span className="text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100">
                    ↓{drop}%
                  </span>
                )}
                <span className="text-muted">{share}%</span>
                <span className="w-12 text-right font-semibold">{s.n}</span>
              </span>
            </div>
            <div className="mt-1.5 h-3.5 overflow-hidden rounded-full bg-black/[0.05]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${share}%`,
                  background: TONE.leads,
                  opacity: Math.max(alpha, 0.4),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- donut */

export function Donut({
  slices,
  total,
  unit = "leads",
}: {
  slices: { label: string; n: number; color: string; href?: string }[];
  total: number;
  unit?: string;
}) {
  const R = 74;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div>
      <div className="relative mx-auto h-[180px] w-[180px]">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="22" />
          {total > 0 &&
            slices.map((s) => {
              const len = (s.n / total) * C;
              const el = (
                <circle
                  key={s.label}
                  cx="90"
                  cy="90"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="22"
                  strokeLinecap="butt"
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-display text-[28px] font-semibold leading-none tabular-nums">{total}</p>
            <p className="mt-1 text-[12px] text-muted">{unit}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {slices.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] transition-colors hover:bg-black/[0.03]"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 truncate text-muted">{s.label}</span>
            <span className="tabular-nums font-medium">{s.n}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- area/bars */

export function Spark({
  data,
  color = TONE.calls,
  height = 150,
  format,
}: {
  data: { label: string; n: number }[];
  color?: string;
  height?: number;
  format?: (n: number) => string;
}) {
  const peak = Math.max(1, ...data.map((d) => d.n));

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="group relative flex-1"
            title={`${d.label}: ${format ? format(d.n) : d.n}`}
          >
            <div
              className="w-full rounded-t-[3px] transition-all group-hover:opacity-100"
              style={{
                height: Math.max((d.n / peak) * height, d.n > 0 ? 3 : 1),
                background: color,
                opacity: i === data.length - 1 ? 1 : 0.28,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- stacks */

export function StatBar({
  label,
  n,
  of,
  color = TONE.leads,
}: {
  label: string;
  n: number;
  of: number;
  color?: string;
}) {
  const p = of ? Math.round((n / of) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium">{n}</span>
          <span className="ml-2 text-muted">{p}%</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.05]">
        <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

/** Lead ageing as one stacked strip, green → red. */
export function AgeStrip({
  buckets,
}: {
  buckets: { label: string; n: number; color: string }[];
}) {
  const total = buckets.reduce((s, b) => s + b.n, 0);

  return (
    <div>
      <div className="flex h-8 overflow-hidden rounded-lg bg-black/[0.04]">
        {total === 0 ? (
          <div className="grid w-full place-items-center text-[12px] text-muted">No open leads</div>
        ) : (
          buckets.map((b) => {
            const w = (b.n / total) * 100;
            if (w === 0) return null;
            return (
              <div
                key={b.label}
                title={`${b.label}: ${b.n}`}
                className="grid place-items-center text-[11px] font-medium text-white transition-all"
                style={{ width: `${w}%`, background: b.color }}
              >
                {w > 8 ? b.n : ""}
              </div>
            );
          })
        )}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-x-4 gap-y-1">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-1.5 text-[12px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: b.color }} />
            <span className="flex-1 truncate text-muted">{b.label}</span>
            <span className="tabular-nums">{b.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- heatmap */

export function HeatMap({ grid }: { grid: number[][] }) {
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const full = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const peak = Math.max(1, ...grid.flat());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[460px]">
        <div className="ml-6 flex">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted">
              {h % 6 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {grid.map((row, d) => (
          <div key={d} className="mt-[2px] flex items-center">
            <div className="w-6 text-[10px] text-muted">{days[d]}</div>
            {row.map((n, h) => (
              <div
                key={h}
                title={`${full[d]} ${h}:00 — ${n} call${n === 1 ? "" : "s"}`}
                className="mx-[1px] h-[11px] flex-1 rounded-[2px] transition-transform hover:scale-125"
                style={{
                  background: n === 0 ? "rgba(0,0,0,0.04)" : `rgba(59,130,246,${0.2 + (n / peak) * 0.8})`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

export function Trend({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="chip bg-black/[0.04] text-[11px] text-muted">new</span>;
  }
  const up = pct >= 0;
  return (
    <span
      className={cx(
        "chip text-[11px] tabular-nums",
        up ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}
