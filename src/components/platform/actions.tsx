"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setRefreshing(true);
        router.refresh();
        window.setTimeout(() => setRefreshing(false), 900);
      }}
      className="p-btn"
      title="Refresh data"
    >
      <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}
