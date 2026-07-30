"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BankAccount } from "@/lib/types";
import { cx } from "@/lib/utils";
import { Plus, Trash2, Loader2, Check, Star, Landmark, X } from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

const BLANK = {
  label: "", bank_name: "", account_name: "", account_number: "",
  ifsc: "", swift: "", upi: "", currency: "INR", qr_url: null as string | null,
};

export function BankAccountsClient({ accounts: initial }: { accounts: BankAccount[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [accounts, setAccounts] = useState(initial);
  const [form, setForm] = useState({ ...BLANK });
  const [open, setOpen] = useState(initial.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function reload() {
    const { data } = await supabase.from("bank_accounts").select("*").order("created_at");
    setAccounts((data ?? []) as BankAccount[]);
    router.refresh();
  }

  async function add() {
    if (!form.label.trim()) { setError("Give the account a label — that's what you'll pick from."); return; }
    if (!form.account_number.trim()) { setError("Account number is required."); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.from("bank_accounts").insert({
      ...form,
      label: form.label.trim(),
      is_default: accounts.length === 0, // first one in becomes the default
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setForm({ ...BLANK });
    setOpen(false);
    reload();
  }

  async function makeDefault(id: string) {
    setBusy(true);
    await supabase.from("bank_accounts").update({ is_default: true }).eq("id", id);
    setBusy(false);
    reload();
  }

  async function toggleActive(a: BankAccount) {
    setBusy(true);
    await supabase.from("bank_accounts").update({ active: !a.active }).eq("id", a.id);
    setBusy(false);
    reload();
  }

  async function remove(id: string) {
    setBusy(true); setError(null);
    const { error: err } = await supabase.from("bank_accounts").delete().eq("id", id);
    setBusy(false); setConfirming(null);
    if (err) { setError(err.message); return; }
    reload();
  }

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-3">
        {accounts.map((a) => (
          <div key={a.id} className={cx("card p-5", !a.active && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted" />
                  <p className="font-display text-base font-semibold">{a.label}</p>
                  {a.is_default && (
                    <span className="chip bg-copper-soft text-copper">
                      <Star className="h-3 w-3" /> default
                    </span>
                  )}
                  <span className="chip bg-black/5 text-muted">{a.currency}</span>
                  {!a.active && <span className="chip bg-black/5 text-muted">hidden</span>}
                </div>
                <div className="mt-2 flex items-start gap-4">
                  {a.qr_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.qr_url} alt="UPI QR" className="h-20 w-20 shrink-0 rounded border border-line object-contain p-1" />
                  )}
                <div className="space-y-0.5 text-[13px] leading-relaxed text-muted">
                  {a.bank_name && <p>{a.bank_name}</p>}
                  {a.account_name && <p>Account name: {a.account_name}</p>}
                  <p>Account no: {a.account_number}</p>
                  {a.ifsc && <p>IFSC: {a.ifsc}</p>}
                  {a.swift && <p>SWIFT: {a.swift}</p>}
                  {a.upi && <p>UPI: {a.upi}</p>}
                </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {!a.is_default && a.active && (
                  <button className="btn-outline text-sm" onClick={() => makeDefault(a.id)} disabled={busy}>
                    <Star className="h-3.5 w-3.5" /> Make default
                  </button>
                )}
                <button className="btn-ghost text-sm text-muted" onClick={() => toggleActive(a)} disabled={busy}>
                  {a.active ? "Hide" : "Unhide"}
                </button>
                {confirming === a.id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <button className="btn-danger text-sm" onClick={() => remove(a.id)} disabled={busy}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
                    </button>
                    <button className="btn-ghost text-sm text-muted" onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button className="btn-ghost px-2" onClick={() => setConfirming(a.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-muted" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {accounts.length === 0 && !open && (
          <div className="card px-5 py-12 text-center">
            <Landmark className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-medium">No bank accounts yet</p>
            <p className="mt-1 text-sm text-muted">
              Add one and it becomes the default on every new invoice.
            </p>
          </div>
        )}
      </div>

      {open ? (
        <div className="card mt-4 p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-base font-semibold">Add an account</p>
            {accounts.length > 0 && (
              <button className="btn-ghost px-2 py-1" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-muted" />
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Label *</label>
              <input
                className="input"
                placeholder="Kotak — Current"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted">Only you see this — it&rsquo;s the dropdown name.</p>
            </div>
            <div>
              <label className="label">Bank name</label>
              <input className="input" value={form.bank_name}
                     onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Account name</label>
              <input className="input" value={form.account_name}
                     onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Account number *</label>
              <input className="input" value={form.account_number}
                     onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
            </div>
            <div>
              <label className="label">IFSC</label>
              <input className="input" value={form.ifsc}
                     onChange={(e) => setForm({ ...form, ifsc: e.target.value })} />
            </div>
            <div>
              <label className="label">SWIFT</label>
              <input className="input" value={form.swift}
                     onChange={(e) => setForm({ ...form, swift: e.target.value })} />
            </div>
            <div>
              <label className="label">UPI</label>
              <input className="input" value={form.upi}
                     onChange={(e) => setForm({ ...form, upi: e.target.value })} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <ImageUpload
                label="UPI QR code"
                value={form.qr_url}
                onChange={(url) => setForm({ ...form, qr_url: url })}
                folder="qr"
                hint="Screenshot the QR from your UPI app and crop it tight. Prints beside the bank details so clients can scan and pay."
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button className="btn-primary" onClick={add} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save account
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-outline mt-4" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add another account
        </button>
      )}
    </>
  );
}
