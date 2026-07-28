/**
 * Shown the instant you click a nav link, while the server fetches.
 *
 * Every page is force-dynamic, so navigation waits on a round trip to Supabase —
 * roughly two seconds from India to the database region. Without this file the
 * browser sits on the old page for that whole time and the app feels stuck.
 * Next renders this immediately and swaps in the real content when it lands, so
 * the click responds now and the wait happens with something on screen.
 */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-8 w-40 rounded-lg bg-black/[0.06]" />
          <div className="mt-2 h-4 w-56 rounded bg-black/[0.04]" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-black/[0.05]" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[220, 130, 150, 140].map((w, i) => (
          <div key={i} className="h-9 rounded-lg bg-black/[0.04]" style={{ width: w }} />
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <div className="h-4 w-24 rounded bg-black/[0.05]" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <div className="h-4 w-4 rounded bg-black/[0.05]" />
            <div className="h-4 flex-1 rounded bg-black/[0.05]" style={{ maxWidth: 260 }} />
            <div className="hidden h-4 w-28 rounded bg-black/[0.04] sm:block" />
            <div className="hidden h-4 w-24 rounded bg-black/[0.04] md:block" />
            <div className="h-5 w-16 rounded-full bg-black/[0.04]" />
            <div className="hidden h-4 w-16 rounded bg-black/[0.04] lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
