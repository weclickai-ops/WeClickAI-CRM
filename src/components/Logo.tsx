import { cx } from "@/lib/utils";

/**
 * WeClick AI brand mark — rebuilt in code to match the brand:
 * orange rounded square with a white "W", then "WeClick" + orange "AI",
 * with a small sparkle accent. Renders crisp at any size, no image needed.
 */
export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      {/* mark */}
      <span
        className="grid h-9 w-9 place-items-center rounded-xl font-display text-lg font-bold text-white shadow-sm"
        style={{ background: "var(--copper)" }}
      >
        W
      </span>

      {/* wordmark */}
      <span
        className={cx(
          "relative font-display text-[17px] font-semibold tracking-tight",
          light ? "text-white" : "text-ink"
        )}
      >
        WeClick<span className="text-copper">&nbsp;AI</span>
        {/* sparkle accent */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="absolute -right-3 -top-1.5 h-3 w-3"
          fill="var(--copper)"
        >
          <path d="M12 0l1.6 8.4L22 10l-8.4 1.6L12 20l-1.6-8.4L2 10l8.4-1.6L12 0z" />
        </svg>
      </span>
    </div>
  );
}
