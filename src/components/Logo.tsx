import { cx } from "@/lib/utils";

/**
 * Brand mark. Right now this is a typographic placeholder in your colours.
 * To use your real logo: drop the PNG/SVG into /public/logo.svg and swap
 * the <span> block below for:  <img src="/logo.svg" alt="WeClick AI" className="h-7" />
 */
export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <div className={cx("flex items-center gap-2", className)}>
      <span
        className="grid h-8 w-8 place-items-center rounded-lg font-display text-lg font-bold text-white"
        style={{ background: "var(--copper)" }}
      >
        W
      </span>
      <span className={cx("font-display text-[17px] font-semibold tracking-tight", light ? "text-white" : "text-ink")}>
        WeClick<span className="text-copper"> AI</span>
      </span>
    </div>
  );
}
