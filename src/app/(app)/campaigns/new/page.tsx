"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "../../PageHeader";
import { Loader2 } from "lucide-react";

const COUNTRIES = [
  ["IN", "India"], ["US", "United States"], ["GB", "United Kingdom"],
  ["AU", "Australia"], ["CA", "Canada"], ["AE", "UAE"], ["SG", "Singapore"],
];

export default function NewCampaignPage() {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    name: "", niche: "", keywords: "", country: "IN", postal_code: "",
    radius_km: 10, run_start: "06:00", run_end: "07:00", only_without_website: true,
  });
  const [runNow, setRunNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd(k: string, v: any) { setF((s) => ({ ...s, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("campaigns").insert({
        ...f, radius_km: Number(f.radius_km), status: "active", created_by: user?.id,
      }).select().single();
      if (error) throw error;

      if (runNow && data) {
        const res = await fetch("/api/scrape", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id: data.id }),
        });
        // don't block navigation on scrape errors — surface but continue
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(`Campaign saved, but the first run failed: ${d.error ?? res.statusText}. You can retry from the campaigns list.`);
          setLoading(false);
          return;
        }
      }
      router.push("/campaigns");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Could not save campaign.");
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="New campaign" subtitle="Drop a postal code anywhere in the world — we center the search there." />

      <form onSubmit={submit} className="card max-w-2xl space-y-5 p-6">
        <div>
          <label className="label">Campaign name</label>
          <input className="input" required value={f.name}
                 onChange={(e) => upd("name", e.target.value)} placeholder="Hyderabad dental clinics" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Niche</label>
            <input className="input" required value={f.niche}
                   onChange={(e) => upd("niche", e.target.value)} placeholder="dental clinics" />
          </div>
          <div>
            <label className="label">Extra keywords (optional)</label>
            <input className="input" value={f.keywords}
                   onChange={(e) => upd("keywords", e.target.value)} placeholder="cosmetic, implants" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Country</label>
            <select className="input" value={f.country} onChange={(e) => upd("country", e.target.value)}>
              {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Postal / PIN / ZIP</label>
            <input className="input" required value={f.postal_code}
                   onChange={(e) => upd("postal_code", e.target.value)} placeholder="500034" />
          </div>
          <div>
            <label className="label">Search radius</label>
            <select className="input" value={f.radius_km} onChange={(e) => upd("radius_km", e.target.value)}>
              {[5, 10, 25, 50].map((r) => <option key={r} value={r}>{r} km</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Daily run window (server time)</label>
          <div className="flex items-center gap-3">
            <input className="input w-auto" type="time" value={f.run_start} onChange={(e) => upd("run_start", e.target.value)} />
            <span className="text-muted">to</span>
            <input className="input w-auto" type="time" value={f.run_end} onChange={(e) => upd("run_end", e.target.value)} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            The cron runner only scrapes campaigns whose current time falls inside this window — keeps API cost predictable.
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={f.only_without_website} className="h-4 w-4 accent-copper"
                 onChange={(e) => upd("only_without_website", e.target.checked)} />
          Only keep businesses with <strong>no website</strong> (the ones you can sell a site to)
        </label>

        <label className="flex items-center gap-2.5 rounded-lg bg-copper-soft px-3 py-2.5 text-sm">
          <input type="checkbox" checked={runNow} className="h-4 w-4 accent-copper"
                 onChange={(e) => setRunNow(e.target.checked)} />
          Run once immediately after saving (don&apos;t wait for the daily window)
        </label>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Saving…" : "Create campaign"}
          </button>
        </div>
      </form>
    </>
  );
}
