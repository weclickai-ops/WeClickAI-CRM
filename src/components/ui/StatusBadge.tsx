import { cx } from "@/lib/utils";

const MAP: Record<string, string> = {
  new:       "bg-black/5 text-ink",
  contacted: "bg-copper-soft text-copper",
  qualified: "bg-amber-100 text-amber-800",
  won:       "bg-emerald-100 text-emerald-800",
  lost:      "bg-red-100 text-red-700",
  draft:     "bg-black/5 text-muted",
  sent:      "bg-copper-soft text-copper",
  paid:      "bg-emerald-100 text-emerald-800",
  void:      "bg-black/5 text-muted line-through",
  active:    "bg-emerald-100 text-emerald-800",
  paused:    "bg-amber-100 text-amber-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cx("chip capitalize", MAP[status] ?? "bg-black/5 text-ink")}>
      {status}
    </span>
  );
}
