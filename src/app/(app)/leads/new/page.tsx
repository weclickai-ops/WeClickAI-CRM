"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "../../PageHeader";
import { Loader2 } from "lucide-react";

export default function NewLeadPage() {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({ business_name: "", phone: "", email: "", website: "", address: "", city: "", category: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upd = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.business_name.trim()) { setError("Business name is required."); return; }
    setLoading(true); setError(null);
    const { data, error } = await supabase.from("leads")
      .insert({ ...f, source: "manual" }).select().single();
    if (error) { setError(error.message); setLoading(false); return; }
    router.push(`/leads/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Add lead" subtitle="Manually add a business you found outside a campaign." />
      <form onSubmit={save} className="card max-w-xl space-y-4 p-6">
        <div>
          <label className="label">Business name</label>
          <input className="input" value={f.business_name} onChange={(e) => upd("business_name", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Phone</label>
            <input className="input" value={f.phone} onChange={(e) => upd("phone", e.target.value)} /></div>
          <div><label className="label">Email</label>
            <input className="input" type="email" value={f.email} onChange={(e) => upd("email", e.target.value)} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Website (leave blank if none)</label>
            <input className="input" value={f.website} onChange={(e) => upd("website", e.target.value)} /></div>
          <div><label className="label">Category</label>
            <input className="input" value={f.category} onChange={(e) => upd("category", e.target.value)} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">City</label>
            <input className="input" value={f.city} onChange={(e) => upd("city", e.target.value)} /></div>
          <div><label className="label">Address</label>
            <input className="input" value={f.address} onChange={(e) => upd("address", e.target.value)} /></div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Save lead
          </button>
        </div>
      </form>
    </>
  );
}
