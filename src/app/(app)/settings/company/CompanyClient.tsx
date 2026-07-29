"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import type { CompanySettings, CompanyContact } from "@/lib/types";
import { Plus, Trash2, Loader2, Check, Building2, Users, FileText, PenLine } from "lucide-react";

export function CompanyClient({ settings }: { settings: CompanySettings }) {
  const supabase = createClient();
  const router = useRouter();

  const [f, setF] = useState({
    legal_name: settings.legal_name ?? "",
    address: settings.address ?? "",
    email: settings.email ?? "",
    phone: settings.phone ?? "",
    website: settings.website ?? "",
    gstin: settings.gstin ?? "",
    pan: settings.pan ?? "",
    default_terms: settings.default_terms ?? "",
    signature_url: settings.signature_url ?? "",
  });
  const [contacts, setContacts] = useState<CompanyContact[]>(
    Array.isArray(settings.contacts) ? settings.contacts : []
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd(patch: Partial<typeof f>) {
    setF({ ...f, ...patch });
    setSaved(false);
  }
  function updContact(i: number, patch: Partial<CompanyContact>) {
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("company_settings")
      .update({
        ...f,
        contacts: contacts.filter((c) => c.name.trim() || c.phone.trim()),
      })
      .eq("id", 1);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    router.refresh();
  }

  const Field = ({
    label, k, placeholder, hint, area = false,
  }: {
    label: string; k: keyof typeof f; placeholder?: string; hint?: string; area?: boolean;
  }) => (
    <div>
      <label className="label">{label}</label>
      {area ? (
        <textarea
          className="input min-h-[90px]"
          placeholder={placeholder}
          value={f[k]}
          onChange={(e) => upd({ [k]: e.target.value } as Partial<typeof f>)}
        />
      ) : (
        <input
          className="input"
          placeholder={placeholder}
          value={f[k]}
          onChange={(e) => upd({ [k]: e.target.value } as Partial<typeof f>)}
        />
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );

  return (
    <>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-5">
        {/* business details */}
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted" />
            <p className="font-display text-base font-semibold">Business details</p>
          </div>
          <p className="mt-1 text-sm text-muted">
            This is the From block on every invoice. Change it here and the next
            invoice picks it up — nothing already sent is altered.
          </p>

          <div className="mt-4"><Logo /></div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Legal name" k="legal_name" placeholder="WeClick AI" />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Business address"
                k="address"
                area
                placeholder={"Shapur Nagar, Jeedimetla\nHyderabad, Telangana 500055"}
                hint="Line breaks are kept, so put it on three or four short lines."
              />
            </div>
            <Field label="Email" k="email" placeholder="hello@weclickai.com" />
            <Field label="Website" k="website" placeholder="weclickai.com" />
            <Field label="Main phone" k="phone" placeholder="+91 93465 14739" />
            <Field label="GSTIN" k="gstin" hint="Left blank, it won't print." />
            <Field label="PAN" k="pan" />
          </div>
        </div>

        {/* contacts */}
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted" />
            <p className="font-display text-base font-semibold">Contacts</p>
          </div>
          <p className="mt-1 text-sm text-muted">
            Both co-founders, or anyone a client should be able to reach. These
            print under the address on the invoice.
          </p>

          <div className="mt-4 space-y-3">
            {contacts.map((c, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input className="input" placeholder="Name" value={c.name}
                       onChange={(e) => updContact(i, { name: e.target.value })} />
                <input className="input" placeholder="Role (optional)" value={c.role ?? ""}
                       onChange={(e) => updContact(i, { role: e.target.value })} />
                <input className="input" placeholder="Phone" value={c.phone}
                       onChange={(e) => updContact(i, { phone: e.target.value })} />
                <button className="btn-ghost px-2" title="Remove"
                        onClick={() => { setContacts((cs) => cs.filter((_, idx) => idx !== i)); setSaved(false); }}>
                  <Trash2 className="h-4 w-4 text-muted" />
                </button>
              </div>
            ))}
            {contacts.length === 0 && (
              <p className="text-[13px] text-muted">No contacts added yet.</p>
            )}
          </div>

          <button
            className="btn-ghost mt-3 text-copper"
            onClick={() => { setContacts((cs) => [...cs, { name: "", role: "", phone: "" }]); setSaved(false); }}
          >
            <Plus className="h-4 w-4" /> Add a contact
          </button>
        </div>

        {/* terms */}
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted" />
            <p className="font-display text-base font-semibold">Terms &amp; conditions</p>
          </div>
          <p className="mt-1 text-sm text-muted">
            Printed as its own section at the foot of every invoice. One point
            per line — they&rsquo;ll be numbered automatically.
          </p>
          <div className="mt-4">
            <textarea
              className="input min-h-[150px] font-mono text-[13px]"
              placeholder={
                "Payment is due within 15 days of the invoice date.\n" +
                "Work begins once the advance is received.\n" +
                "Late payments may attract interest at 1.5% per month.\n" +
                "Any disputes are subject to Hyderabad jurisdiction."
              }
              value={f.default_terms}
              onChange={(e) => upd({ default_terms: e.target.value })}
            />
          </div>
        </div>

        {/* signature */}
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-muted" />
            <p className="font-display text-base font-semibold">Signature</p>
          </div>
          <p className="mt-1 text-sm text-muted">
            Paste a link to a PNG of your signature — ideally on a transparent
            background. It prints above the signature line. Leave it empty and
            the line stays blank for signing by hand.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Signature image URL" k="signature_url" placeholder="https://…/signature.png" />
            <div>
              <p className="label">Preview</p>
              <div className="grid h-[62px] place-items-center rounded-lg border border-dashed border-line">
                {f.signature_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.signature_url} alt="Signature" className="max-h-[54px] object-contain" />
                ) : (
                  <span className="text-xs text-muted">nothing yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-4 mt-5 flex items-center justify-end gap-3">
        {saved && (
          <span className="chip bg-emerald-100 text-emerald-800">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        <button className="btn-primary shadow-lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save profile
        </button>
      </div>
    </>
  );
}
