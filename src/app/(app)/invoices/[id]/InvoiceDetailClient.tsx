"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { money, cx } from "@/lib/utils";
import type { Invoice, CompanySettings, BankAccount } from "@/lib/types";
import {
  ArrowLeft, Printer, Check, Send, Ban, Trash2, Loader2, Mail, ExternalLink,
} from "lucide-react";

const METHODS = ["Bank transfer", "UPI", "Cash", "Card", "Cheque", "Razorpay"];
const FINANCE_URL =
  process.env.NEXT_PUBLIC_FINANCE_URL ?? "https://weclick-ai-finance.vercel.app";

const BADGE: Record<string, { label: string; cls: string }> = {
  draft:          { label: "Draft",       cls: "bg-black/5 text-muted" },
  sent:           { label: "Pending",     cls: "bg-amber-100 text-amber-800" },
  partially_paid: { label: "Part paid",   cls: "bg-amber-100 text-amber-800" },
  paid:           { label: "Paid",        cls: "bg-emerald-100 text-emerald-800" },
  void:           { label: "Void",        cls: "bg-black/5 text-muted line-through" },
  written_off:    { label: "Written off", cls: "bg-black/5 text-muted line-through" },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function InvoiceDetailClient({
  invoice: initial,
  company,
  bank,
  autoPrint = false,
}: {
  invoice: Invoice;
  company: CompanySettings | null;
  bank: BankAccount | null;
  autoPrint?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [inv, setInv] = useState<Invoice>(initial);
  const [error, setError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const balance = Number(inv.total) - Number(inv.amount_paid ?? 0);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState(String(balance > 0 ? balance : ""));
  const [payDate, setPayDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [payMethod, setPayMethod] = useState(METHODS[0]);
  const [payRef, setPayRef] = useState("");

  useEffect(() => {
    if (autoPrint) setTimeout(() => window.print(), 400);
  }, [autoPrint]);

  const badge = BADGE[inv.status] ?? { label: inv.status, cls: "bg-black/5 text-ink" };

  async function setStatus(status: Invoice["status"]) {
    setInv((i) => ({ ...i, status }));
    await supabase.from("invoices").update({ status }).eq("id", inv.id);
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const { error: err } = await supabase.from("invoices").delete().eq("id", inv.id);
    if (err) { setDeleting(false); setError(err.message); return; }
    router.push("/invoices");
    router.refresh();
  }

  /**
   * Payments are recorded as invoice_payments rows, never by setting status by
   * hand. A trigger recalculates amount_paid, status and paid_at from those
   * rows, and the Finance app reads the same rows for Money in.
   */
  async function recordPayment() {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setPaying(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("invoice_payments").insert({
      invoice_id: inv.id, amount: amt, paid_on: payDate,
      method: payMethod, reference: payRef.trim() || null, recorded_by: user?.id ?? null,
    });
    if (err) { setPaying(false); setError(err.message); return; }
    const { data: fresh } = await supabase.from("invoices").select("*").eq("id", inv.id).single();
    setPaying(false);
    if (fresh) setInv(fresh as Invoice);
    setPayOpen(false);
    setPayRef("");
    router.refresh();
  }

  // The account picked on this invoice wins; company_settings is the fallback
  // for anything raised before bank accounts existed.
  const payTo = bank ?? company;
  const contacts = Array.isArray(company?.contacts) ? company!.contacts : [];

  // One point per line in settings becomes one numbered clause here.
  const terms = (company?.default_terms ?? "")
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  const bankLines = payTo
    ? [
        payTo.bank_name && `Bank: ${payTo.bank_name}`,
        payTo.account_name && `Account name: ${payTo.account_name}`,
        payTo.account_number && `Account no: ${payTo.account_number}`,
        payTo.ifsc && `IFSC: ${payTo.ifsc}`,
        payTo.swift && `SWIFT: ${payTo.swift}`,
        payTo.upi && `UPI: ${payTo.upi}`,
      ].filter(Boolean) as string[]
    : [];

  return (
    <>
      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Invoices
        </Link>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Download PDF
          </button>
          {inv.status === "draft" && (
            <button className="btn-outline" onClick={() => setStatus("sent")}>
              <Send className="h-4 w-4" /> Mark sent
            </button>
          )}
          <button
            className="btn-outline text-muted"
            title="Email delivery isn't wired up yet — needs a verified sending domain"
            onClick={() =>
              setError("Email sending isn't configured yet. Download the PDF and attach it for now.")
            }
          >
            <Mail className="h-4 w-4" /> Send by email
          </button>
          {!["paid", "void", "written_off"].includes(inv.status) && (
            <button className="btn-primary" onClick={() => setPayOpen((v) => !v)}>
              <Check className="h-4 w-4" /> Mark as paid
            </button>
          )}
          {!["paid", "void"].includes(inv.status) && (
            <button className="btn-ghost text-muted" onClick={() => setStatus("void")}>
              <Ban className="h-4 w-4" /> Void
            </button>
          )}
          <a href={`${FINANCE_URL}/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer"
             className="btn-ghost text-muted" title="Open in Finance">
            <ExternalLink className="h-4 w-4" />
          </a>
          {confirming ? (
            <span className="inline-flex items-center gap-2">
              <button className="btn-danger" onClick={remove} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete for good
              </button>
              <button className="btn-ghost text-muted" onClick={() => setConfirming(false)}>Cancel</button>
            </span>
          ) : (
            <button className="btn-ghost text-muted" onClick={() => setConfirming(true)} title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {payOpen && (
        <div className="card mx-auto mb-3 max-w-3xl p-5 print:hidden">
          <p className="font-display text-base font-semibold">Record the payment</p>
          <p className="mt-1 text-sm text-muted">
            Appears under Money in on Finance straight away. Part payments are fine.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Amount</label>
              <input className="input" inputMode="decimal" value={payAmount}
                     onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Received on</label>
              <input type="date" className="input" value={payDate}
                     onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Method</label>
              <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reference</label>
              <input className="input" placeholder="UTR / txn id" value={payRef}
                     onChange={(e) => setPayRef(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost text-muted" onClick={() => setPayOpen(false)} disabled={paying}>
              Cancel
            </button>
            <button className="btn-primary" onClick={recordPayment} disabled={paying}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save payment
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mx-auto mb-3 max-w-3xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
          {error}
        </p>
      )}

      {/* the document */}
      <div className="card mx-auto max-w-3xl bg-white p-8 sm:p-10 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="label">From</p>
            <div className="mt-1"><Logo /></div>
            <div className="mt-2 space-y-0.5 text-[13px] leading-relaxed text-muted">
              {company?.legal_name && <p className="font-medium text-ink">{company.legal_name}</p>}
              {company?.address && <p className="whitespace-pre-line">{company.address}</p>}
              {company?.phone && <p>{company.phone}</p>}
              {contacts.map((c) => (
                <p key={`${c.name}-${c.phone}`}>
                  {c.name}{c.role ? ` (${c.role})` : ""}{c.name && c.phone ? " · " : ""}{c.phone}
                </p>
              ))}
              {company?.email && <p>{company.email}</p>}
              {company?.website && <p>{company.website}</p>}
              {company?.gstin && <p>GSTIN: {company.gstin}</p>}
              {company?.pan && <p>PAN: {company.pan}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold tracking-tight">Invoice</p>
            <p className="mt-1 text-sm text-muted">{inv.number}</p>
            <span className={cx("chip mt-2", badge.cls)}>{badge.label}</span>
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="label">Billed to</p>
            <p className="font-medium">{inv.client_name}</p>
            <div className="mt-0.5 space-y-0.5 text-[13px] leading-relaxed text-muted">
              {inv.client_company && <p>{inv.client_company}</p>}
              {inv.client_address && <p className="whitespace-pre-line">{inv.client_address}</p>}
              {inv.client_email && <p>{inv.client_email}</p>}
              {inv.client_phone && <p>{inv.client_phone}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="inline-block space-y-1 text-[13px]">
              <p><span className="text-muted">Invoice date: </span>{fmtDate(inv.issued_on ?? inv.issued_at)}</p>
              <p><span className="text-muted">Due date: </span>{fmtDate(inv.due_date)}</p>
              {inv.paid_at && (
                <p className="text-emerald-700">Paid {fmtDate(inv.paid_at)}</p>
              )}
            </div>
          </div>
        </div>

        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink/10">
              <th className="th">Service</th>
              <th className="th text-right">Qty</th>
              <th className="th text-right">Unit price</th>
              <th className="th text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.line_items.map((l, i) => (
              <tr key={i} className="border-b border-line">
                <td className="td">{l.desc}</td>
                <td className="td text-right tabular-nums">{l.qty}</td>
                <td className="td text-right tabular-nums">{money(l.rate, inv.currency)}</td>
                <td className="td text-right tabular-nums">{money(l.qty * l.rate, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="tabular-nums">{money(Number(inv.subtotal), inv.currency)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t-2 border-ink/10 pt-2">
              <span className="font-medium">Total</span>
              <span className="font-display text-xl font-semibold tabular-nums">
                {money(Number(inv.total), inv.currency)}
              </span>
            </div>
            {Number(inv.amount_paid ?? 0) > 0 && balance > 0 && (
              <>
                <div className="flex justify-between text-emerald-700">
                  <span>Paid so far</span>
                  <span className="tabular-nums">{money(Number(inv.amount_paid), inv.currency)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Balance due</span>
                  <span className="tabular-nums">{money(balance, inv.currency)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {bankLines.length > 0 && (
          <div className="mt-10 border-t border-line pt-6 text-[13px]">
            <p className="label">Payment details</p>
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-0.5 leading-relaxed text-muted">
                {bankLines.map((b) => <p key={b}>{b}</p>)}
                {company?.website && <p className="pt-1">{company.website}</p>}
              </div>
              {bank?.qr_url && (
                <div className="shrink-0 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bank.qr_url} alt="Scan to pay" className="h-24 w-24 object-contain" />
                  <p className="mt-1 text-[11px] text-muted">Scan to pay</p>
                </div>
              )}
            </div>
          </div>
        )}

        {inv.notes && (
          <p className="mt-6 whitespace-pre-line text-[13px] leading-relaxed text-muted">
            {inv.notes}
          </p>
        )}

        {terms.length > 0 && (
          <div className="mt-8 border-t border-line pt-5">
            <p className="label">Terms &amp; conditions</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-[12px] leading-relaxed text-muted">
              {terms.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </div>
        )}

        <div className="mt-14 flex justify-end">
          <div className="w-56 text-center">
            <div className="flex h-12 items-end justify-center">
              {company?.signature_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.signature_url} alt="" className="max-h-11 object-contain" />
              )}
            </div>
            <div className="border-b border-ink/25" />
            <p className="mt-2 text-[12px] text-muted">
              Authorised signature<br />
              {company?.legal_name ?? "WeClick AI"}
            </p>
          </div>
        </div>
      </div>

      {!company && (
        <p className="mx-auto mt-3 max-w-3xl text-xs text-muted print:hidden">
          Company address, GSTIN and bank details are blank because
          Settings → Company &amp; invoice hasn&rsquo;t been filled in on the
          Finance app yet. Fill it once and every invoice picks it up.
        </p>
      )}
    </>
  );
}
