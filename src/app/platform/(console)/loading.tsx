export default function PlatformLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading platform console">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-7 w-72 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-3 w-96 max-w-full animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-[#111b2b]"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <div className="h-[380px] animate-pulse rounded-2xl border border-white/[0.05] bg-[#111b2b]" />
        <div className="h-[380px] animate-pulse rounded-2xl border border-white/[0.05] bg-[#111b2b]" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-white/[0.05] bg-[#111b2b]" />
    </div>
  );
}
