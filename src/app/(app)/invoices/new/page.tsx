"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "../../PageHeader";
import { money } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import type { CompanySettings, BankAccount } from "@/lib/types";
import { Plus, Trash2, Loader2, Search, Check, X } from "lucide-react";

type Line = { desc: string; qty: number; rate: number };
type LeadHit = {
  id: string; business_name: string; person_name: string | null;
  email: string | null; phone: string | null; address: string | null;
};

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD"];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const leadParam = params.get("lead");
  const clientParam = params.get("client");

  const [leadId, setLeadId] = useState<string | null>(leadParam);
  const [clientId, setClientId] = useState<string | null>(clientParam);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  const [issuedOn, setIssuedOn] = useState(() => ymd(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return ymd(d);
  });
  const [currency, setCurrency] = useState("INR");
  const [status, setStatus] = useState<"draft" | "sent">("draft");

  const [lines, setLines] = useState<Line[]>([{ desc: "", qty: 1, rate: 0 }]);
  const [notes, setNotes] = useState(
    "Thank you for choosing WeClick AI. Looking forward to working with you."
  );

  // Bill From is read-only and always the live Company Profile, so an invoice
  // raised today can never carry last month's address.
  const [company, setCompany] = useState<CompanySettings | null | undefined>(undefined);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [bankId, setBankId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("company_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setCompany((data as CompanySettings) ?? null));

    supabase
      .from("bank_accounts")
      .select("*")
      .eq("active", true)
      .order("created_at")
      .then(({ data }) => {
        const rows = (data ?? []) as BankAccount[];
        setBanks(rows);
        // pre-select the default so raising an invoice stays a one-minute job
        setBankId(rows.find((b) => b.is_default)?.id ?? rows[0]?.id ?? "");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arriving from a client workspace — fill from the client record.
  useEffect(() => {
    if (!clientParam) return;
    supabase
      .from("clients")
      .select("id, company_name, contact_name, email, phone, address, lead_id")
      .eq("id", clientParam)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setClientName(data.contact_name || data.company_name);
        setClientCompany(data.contact_name ? data.company_name : "");
        setClientEmail(data.email ?? "");
        setClientPhone(data.phone ?? "");
        setClientAddress(data.address ?? "");
        if (data.lead_id) setLeadId(data.lead_id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientParam]);

  // Arriving from a lead page — fill straight away.
  useEffect(() => {
    if (!leadParam) return;
    supabase
      .from("leads")
      .select("id, business_name, person_name, email, phone, address")
      .eq("id", leadParam)
      .single()
      .then(({ data }) => data && fill(data as LeadHit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadParam]);

  // Debounced client search across existing leads.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("leads")
        .select("id, business_name, person_name, email, phone, address")
        .or(`business_name.ilike.%${q}%,person_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(6);
      setHits((data ?? []) as LeadHit[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function fill(l: LeadHit) {
    setLeadId(l.id);
    setClientName(l.person_name || l.business_name);
    setClientCompany(l.person_name ? l.business_name : "");
    setClientEmail(l.email ?? "");
    setClientPhone(l.phone ?? "");
    setClientAddress(l.address ?? "");
    setQuery("");
    setHits([]);
  }

  function clearClient() {
    setLeadId(null);
    setClientName(""); setClientCompany(""); setClientEmail("");
    setClientPhone(""); setClientAddress("");
  }

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0),
    [lines]
  );

  function updLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    if (!clientName.trim()) { setError("Client name is required."); return; }
    if (!clientEmail.trim()) { setError("Client email is required."); return; }
    const usable = lines.filter((l) => l.desc.trim() && (Number(l.qty) || 0) > 0);
    if (usable.length === 0) { setError("Add at least one service with a description."); return; }

    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Numbering comes from company_settings via the shared RPC, so the CRM
      // and the Finance app can never hand out the same number twice.
      let number: string;
      const { data: rpcNumber, error: rpcErr } = await supabase.rpc("next_invoice_number");
      if (rpcErr || !rpcNumber) {
        const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
        number = `WCAI-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
      } else {
        number = rpcNumber as string;
      }

      const { data, error: err } = await supabase.from("invoices").insert({
        number,
        lead_id: leadId,
        client_id: clientId,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        client_phone: clientPhone.trim() || null,
        client_company: clientCompany.trim() || null,
        client_address: clientAddress.trim() || null,
        currency,
        line_items: usable,
        subtotal: total,
        tax_percent: 0,
        total,
        status,
        issued_on: issuedOn,
        issued_at: new Date().toISOString(),
        bank_account_id: bankId || null,
        due_date: dueDate || null,
        notes: notes.trim() || null,
        created_by: user?.id,
      }).select().single();
      if (err) throw err;

      router.push(`/invoices/${data.id}`);
      router.refresh();
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? "Could not create the invoice.");
    }
  }

  return (
    <>
      <PageHeader title="New invoice" subtitle="Service invoice — no tax or discount applied" />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {/* from + client */}
          <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
            {/* from — read-only, pulled from Settings → Company profile */}
            <div className="card p-5">
              <p className="font-display text-base font-semibold">
                From{company?.legal_name ? ` (${company.legal_name})` : ""}
              </p>
              <div className="mt-3"><Logo /></div>

              {company === undefined && (
                <p className="mt-3 text-[13px] text-muted">Loading company details…</p>
              )}

              {company === null && (
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  No company profile set yet. Fill it in once under
                  Settings &rarr; Company &amp; invoice and every invoice picks
                  it up automatically.
                </p>
              )}

              {company && (
                <div className="mt-3 space-y-1 text-[13px] leading-relaxed text-muted">
                  <p className="font-medium text-ink">{company.legal_name}</p>
                  {company.address && <p className="whitespace-pre-line">{company.address}</p>}
                  {company.phone && <p>{company.phone}</p>}
                  {(Array.isArray(company.contacts) ? company.contacts : []).map((c) => (
                    <p key={`${c.name}-${c.phone}`}>
                      {c.name}{c.role ? ` (${c.role})` : ""}{c.name && c.phone ? " · " : ""}{c.phone}
                    </p>
                  ))}
                  {company.email && <p>{company.email}</p>}
                  {company.website && <p>{company.website}</p>}
                  {company.gstin && <p>GSTIN: {company.gstin}</p>}
                </div>
              )}
            </div>

            {/* client */}
            <div className="card p-5">
            <p className="font-display text-base font-semibold">Client</p>

            {!leadId && (
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-9"
                  placeholder="Search existing leads to autofill…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
                )}
                {hits.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                    {hits.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => fill(h)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/[0.03]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{h.business_name}</span>
                          <span className="block truncate text-xs text-muted">
                            {[h.person_name, h.email].filter(Boolean).join(" · ") || "no contact details"}
                          </span>
                        </span>
                        <Plus className="h-4 w-4 shrink-0 text-muted" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {leadId && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <Check className="h-4 w-4" />
                <span className="flex-1">Linked to a CRM lead — revenue will credit its owner.</span>
                <button className="btn-ghost px-1.5 py-1" onClick={clearClient} title="Unlink">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Client name *</label>
                <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <label className="label">Client email *</label>
                <input className="input" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
              <div>
                <label className="label">Company</label>
                <input className="input" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Billing address</label>
                <input className="input" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
              </div>
            </div>
            </div>
          </div>

          {/* services */}
          <div className="card p-5">
            <p className="font-display text-base font-semibold">Services</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="th">Description</th>
                    <th className="th w-20 text-right">Qty</th>
                    <th className="th w-32 text-right">Unit price</th>
                    <th className="th w-32 text-right">Amount</th>
                    <th className="th w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-2 py-2">
                        <input
                          className="input"
                          placeholder="Website design & development"
                          value={l.desc}
                          onChange={(e) => updLine(i, { desc: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="input text-right"
                          inputMode="numeric"
                          value={l.qty}
                          onChange={(e) => updLine(i, { qty: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="input text-right"
                          inputMode="decimal"
                          value={l.rate}
                          onChange={(e) => updLine(i, { rate: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="td text-right font-medium tabular-nums">
                        {money((Number(l.qty) || 0) * (Number(l.rate) || 0), currency)}
                      </td>
                      <td className="px-2 py-2">
                        {lines.length > 1 && (
                          <button
                            className="btn-ghost px-2"
                            onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4 text-muted" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn-ghost mt-3 text-copper"
              onClick={() => setLines((ls) => [...ls, { desc: "", qty: 1, rate: 0 }])}
            >
              <Plus className="h-4 w-4" /> Add another service
            </button>
          </div>

          {/* notes */}
          <div className="card p-5">
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[90px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* summary rail */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-5">
            <p className="font-display text-base font-semibold">Invoice</p>
            <p className="mt-1 text-sm text-muted">Number is generated when you save.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Invoice date</label>
                <input type="date" className="input" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
              </div>
              <div>
                <label className="label">Due date</label>
                <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Currency</label>
                  <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "draft" | "sent")}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Pending</option>
                  </select>
                </div>
              </div>

              {banks.length > 0 && (
                <div>
                  <label className="label">Pay into</label>
                  <select className="input" value={bankId} onChange={(e) => setBankId(e.target.value)}>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}{b.currency !== "INR" ? ` · ${b.currency}` : ""}
                      </option>
                    ))}
                    <option value="">No bank details</option>
                  </select>
                  <p className="mt-1 text-xs text-muted">Printed on the invoice as payment details.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="tabular-nums">{money(total, currency)}</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="font-medium">Total</span>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {money(total, currency)}
              </span>
            </div>

            <button className="btn-primary mt-4 w-full" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create invoice
            </button>
            <button
              className="btn-ghost mt-2 w-full text-muted"
              onClick={() => router.push("/invoices")}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
