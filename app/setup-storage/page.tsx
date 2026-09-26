"use client";

import { useState } from "react";
import Link from "next/link";

export default function SetupStorage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSetup = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/setup-storage", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to create storage bucket");
      }
    } catch {
      setStatus("error");
      setMessage("Network error");
    }
  };

  return (
    <div className="authPage">
      <div className="authCard" style={{ textAlign: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Setup Storage</h1>
        <p className="subtitle">Create the avatars storage bucket for profile pictures.</p>

        <button
          onClick={handleSetup}
          disabled={status === "loading"}
          className="btn btnPrimary btnLarge"
          style={{ width: "100%", marginBottom: 16 }}
        >
          {status === "loading" ? "Setting up..." : "Initialize Storage"}
        </button>

        {status === "success" && (
          <div className="message" style={{ marginBottom: 16 }}>{message}</div>
        )}
        {status === "error" && (
          <div className="authError">{message}</div>
        )}

        <Link href="/dashboard/profile" className="authLink">
          Go to Profile →
        </Link>
      </div>
    </div>
  );
}
