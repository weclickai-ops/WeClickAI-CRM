"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Logo } from "@/components/Logo";
import { money } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { ArrowLeft, Printer, Check, Send, Ban, Trash2, ExternalLink, Loader2 } from "lucide-react";

const FINANCE_URL =
  process.env.NEXT_PUBLIC_FINANCE_URL ?? "https://weclick-ai-finance.vercel.app";

export function InvoiceDetailClient({ invoice: initial }: { invoice: Invoice }) {
  const supabase = createClient();
  const router = useRouter();
  const [inv, setInv] = useState<Invoice>(initial);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Hard delete. Payments cascade; use Void instead if the invoice was ever issued. */
  async function remove() {
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase.from("invoices").delete().eq("id", inv.id);
    if (err) { setDeleting(false); setError(err.message); return; }
    router.push("/invoices");
    router.refresh();
  }

  async function setStatus(status: InvoiceStatus) {
    const patch: any = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    setInv((i) => ({ ...i, ...patch }));
    await supabase.from("invoices").update(patch).eq("id", inv.id);
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Invoices
        </Link>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          {inv.status === "draft" && (
            <button className="btn-outline" onClick={() => setStatus("sent")}>
              <Send className="h-4 w-4" /> Mark sent
            </button>
          )}
          {inv.status !== "paid" && inv.status !== "void" && (
            <button className="btn-primary" onClick={() => setStatus("paid")}>
              <Check className="h-4 w-4" /> Mark as paid
            </button>
          )}
          {inv.status !== "void" && inv.status !== "paid" && (
            <button className="btn-ghost text-muted" onClick={() => setStatus("void")}>
              <Ban className="h-4 w-4" /> Void
            </button>
          )}
          <a href={`${FINANCE_URL}/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer"
             className="btn-outline" title="Full invoice document, payments and email">
            <ExternalLink className="h-4 w-4" /> Open in Finance
          </a>
          {confirming ? (
            <span className="inline-flex items-center gap-2">
              <button className="btn-danger" onClick={remove} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete for good
              </button>
              <button className="btn-ghost text-muted" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancel
              </button>
            </span>
          ) : (
            <button className="btn-ghost text-muted" onClick={() => setConfirming(true)} title="Delete permanently">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mx-auto mb-3 max-w-3xl rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {error}
        </p>
      )}

      <div className="card mx-auto max-w-3xl p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <Logo />
          <div className="text-right">
            <p className="font-display text-2xl font-semibold">Invoice</p>
            <p className="text-sm text-muted">{inv.number}</p>
            <div className="mt-1"><StatusBadge status={inv.status} /></div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="label">Billed to</p>
            <p className="font-medium">{inv.client_name}</p>
            {inv.client_email && <p className="text-muted">{inv.client_email}</p>}
          </div>
          <div className="text-right">
            {inv.due_date && <p><span className="text-muted">Due: </span>{inv.due_date}</p>}
            {inv.paid_at && <p className="text-emerald-700">Paid {new Date(inv.paid_at).toLocaleDateString("en-IN")}</p>}
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead><tr className="border-b border-line">
            <th className="th">Description</th>
            <th className="th text-right">Qty</th>
            <th className="th text-right">Rate</th>
            <th className="th text-right">Amount</th>
          </tr></thead>
          <tbody>
            {inv.line_items.map((l, i) => (
              <tr key={i} className="border-b border-line">
                <td className="td">{l.desc}</td>
                <td className="td text-right">{l.qty}</td>
                <td className="td text-right">{money(l.rate, inv.currency)}</td>
                <td className="td text-right">{money(l.qty * l.rate, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{money(Number(inv.subtotal), inv.currency)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Tax ({inv.tax_percent}%)</span><span>{money(Number(inv.total) - Number(inv.subtotal), inv.currency)}</span></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <span>Total</span><span>{money(Number(inv.total), inv.currency)}</span>
          </div>
          {Number(inv.amount_paid) > 0 && Number(inv.amount_paid) < Number(inv.total) && (
            <>
              <div className="flex justify-between text-emerald-700">
                <span>Paid so far</span><span>{money(Number(inv.amount_paid), inv.currency)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Balance due</span>
                <span>{money(Number(inv.total) - Number(inv.amount_paid), inv.currency)}</span>
              </div>
            </>
          )}
        </div>

        {inv.notes && <p className="mt-8 border-t border-line pt-4 text-sm text-muted">{inv.notes}</p>}
      </div>
    </>
  );
}
