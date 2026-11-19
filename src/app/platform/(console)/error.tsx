"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111b2b] p-6 text-center shadow-2xl">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-300">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-100">Console could not load</h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-400">
          The platform data request failed. Retry the screen; if it keeps failing, check the server
          logs and the database connection.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[0.65rem] text-slate-600">digest {error.digest}</p>
        )}
        <button type="button" onClick={reset} className="p-btn p-btn-primary mt-5">
          <RefreshCw className="size-3.5" /> Try again
        </button>
      </div>
    </div>
  );
}
