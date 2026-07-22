"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, Check } from "lucide-react";

export function CampaignRunButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    setState("running"); setMsg("");
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      setState("done");
      setMsg(`+${data.inserted} new`);
      router.refresh();
      setTimeout(() => setState("idle"), 4000);
    } catch (e: any) {
      setState("error");
      setMsg(e.message);
    }
  }

  return (
    <button onClick={run} disabled={state === "running"} className="btn-outline text-sm">
      {state === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
      {state === "done" && <Check className="h-4 w-4 text-emerald-600" />}
      {(state === "idle" || state === "error") && <Play className="h-4 w-4" />}
      {state === "running" ? "Running…" : state === "done" ? msg : state === "error" ? "Retry" : "Run once now"}
    </button>
  );
}
