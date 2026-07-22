"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "../../PageHeader";
import { money } from "@/lib/utils";
import { Plus, Trash2, Loader2 } from "lucide-react";

type Line = { desc: string; qty: number; rate: number };

export default function NewInvoicePage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const leadId = params.get("lead");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [taxPercent, setTaxPercent] = useState(18);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ desc: "Website design & development", qty: 1, rate: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // prefill from a lead if arriving via "Create invoice"
  useEffect(() => {
    if (!leadId) return;
    supabase.from("leads").select("business_name, email").eq("id", leadId).single()
      .then(({ data }) => { if (data) { setClientName(data.business_name); setClientEmail(data.email ?? ""); } });
  }, [leadId]);

  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const total = subtotal * (1 + taxPercent / 100);

  function updLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    if (!clientName.trim()) { setError("Client name is required."); return; }
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
      const number = `WC-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

      const { data, error } = await supabase.from("invoices").insert({
        number, lead_id: leadId, client_name: clientName, client_email: clientEmail,
        currency, line_items: lines, subtotal, tax_percent: taxPercent, total,
        status: "draft", due_date: dueDate || null, notes, created_by: user?.id,
        issued_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      router.push(`/invoices/${data.id}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not create invoice.");
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="New invoice" subtitle="Manual invoice — mark it paid yourself for now. Razorpay plugs in later." />

      <div className="card max-w-3xl space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Client name</label>
            <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div>
            <label className="label">Client email</label>
            <input className="input" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
        </div>

        {/* line items */}
        <div>
          <label className="label">Line items</label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input flex-1" placeholder="Description" value={l.desc}
                       onChange={(e) => updLine(i, { desc: e.target.value })} />
                <input className="input w-16" type="number" min={1} value={l.qty}
                       onChange={(e) => updLine(i, { qty: Number(e.target.value) })} />
                <input className="input w-28" type="number" min={0} placeholder="Rate" value={l.rate}
                       onChange={(e) => updLine(i, { rate: Number(e.target.value) })} />
                <button className="btn-ghost px-2" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-muted" />
                </button>
              </div>
            ))}
          </div>
          <button className="btn-ghost mt-2 text-copper" onClick={() => setLines((ls) => [...ls, { desc: "", qty: 1, rate: 0 }])}>
            <Plus className="h-4 w-4" /> Add line
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Currency</label>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["INR", "USD", "GBP", "AUD", "AED"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tax %</label>
            <input className="input" type="number" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Due date</label>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-end justify-between border-t border-line pt-4">
          <div className="text-sm text-muted">
            <div>Subtotal: <span className="text-ink">{money(subtotal, currency)}</span></div>
            <div>Tax ({taxPercent}%): <span className="text-ink">{money(total - subtotal, currency)}</span></div>
            <div className="mt-1 text-lg font-semibold text-ink">Total: {money(total, currency)}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => router.back()}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create invoice
            </button>
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </>
  );
}
