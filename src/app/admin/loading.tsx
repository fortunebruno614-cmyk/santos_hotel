export default function AdminLoading() {
  return (
    <div className="-m-6 min-h-full animate-pulse bg-[#f7f8fa] p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-40 rounded bg-zinc-200/80" />
            <div className="h-3 w-56 rounded bg-zinc-200/60" />
          </div>
          <div className="h-8 w-32 rounded-md bg-zinc-200/70" />
        </div>
        <div className="h-8 w-72 rounded-md bg-zinc-200/60" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[92px] rounded-lg border border-zinc-200 bg-white" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.85fr)]">
          <div className="space-y-4">
            <div className="h-[360px] rounded-lg border border-zinc-200 bg-white" />
            <div className="h-[420px] rounded-lg border border-zinc-200 bg-white" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-48 rounded-lg border border-zinc-200 bg-white" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
