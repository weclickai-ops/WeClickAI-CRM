export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-28 rounded-lg bg-black/[0.06]" />
        <div className="mt-2 h-4 w-40 rounded bg-black/[0.04]" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="h-5 w-64 rounded bg-black/[0.06]" />
            <div className="mt-2 h-3.5 w-48 rounded bg-black/[0.04]" />
            <div className="mt-3 h-8 w-40 rounded-lg bg-black/[0.05]" />
          </div>
        ))}
      </div>
    </div>
  );
}
