/** Board-shaped skeleton, so the shape doesn't jump when the real one arrives. */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-36 rounded-lg bg-black/[0.06]" />
        <div className="mt-2 h-4 w-72 rounded bg-black/[0.04]" />
      </div>
      <div className="space-y-6">
        {[3, 4, 5].map((cols, g) => (
          <div key={g}>
            <div className="mb-2 h-4 w-24 rounded bg-black/[0.05]" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: cols }).map((_, i) => (
                <div key={i} className="w-72 shrink-0 rounded-xl2 border border-line bg-black/[0.015] p-3">
                  <div className="mb-3 h-4 w-24 rounded bg-black/[0.06]" />
                  {Array.from({ length: i === 0 ? 3 : 1 }).map((_, c) => (
                    <div key={c} className="mb-2 h-20 rounded-lg bg-black/[0.04]" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
