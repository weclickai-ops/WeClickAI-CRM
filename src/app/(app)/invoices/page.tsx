import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { InvoiceFilters, InvoiceRowActions } from "./InvoiceListClient";
import { money, cx } from "@/lib/utils";
import { FileText, Plus } from "lucide-react";
import type { Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Database status → the three words we actually show clients. */
const BADGE: Record<string, { label: string; cls: string }> = {
  draft:          { label: "Draft",     cls: "bg-black/5 text-muted" },
  sent:           { label: "Pending",   cls: "bg-amber-100 text-amber-800" },
  partially_paid: { label: "Part paid", cls: "bg-amber-100 text-amber-800" },
  paid:           { label: "Paid",      cls: "bg-emerald-100 text-emerald-800" },
  void:           { label: "Void",      cls: "bg-black/5 text-muted line-through" },
  written_off:    { label: "Written off", cls: "bg-black/5 text-muted line-through" },
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  let q = supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.range) {
    const d = new Date();
    d.setDate(d.getDate() - Number(sp.range));
    q = q.gte("created_at", d.toISOString());
  }
  if (sp.q) q = q.or(`number.ilike.%${sp.q}%,client_name.ilike.%${sp.q}%`);

  const { data } = await q;
  const invoices = (data ?? []) as Invoice[];

  const collected = invoices.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const outstanding = invoices
    .filter((i) => !["void", "written_off"].includes(i.status))
    .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid ?? 0)), 0);

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`${money(collected)} collected · ${money(outstanding)} outstanding`}
        action={
          <Link href="/invoices/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New invoice
          </Link>
        }
      />

      <InvoiceFilters active={{ q: sp.q ?? "", status: sp.status ?? "", range: sp.range ?? "" }} />

      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-medium">No invoices here</p>
            <p className="mt-1 text-sm text-muted">
              {sp.q || sp.status || sp.range
                ? "Nothing matches those filters."
                : "Create one from a lead, or start a blank one."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th">Invoice no</th>
                  <th className="th">Client</th>
                  <th className="th">Date</th>
                  <th className="th">Due date</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const badge = BADGE[inv.status] ?? { label: inv.status, cls: "bg-black/5 text-ink" };
                  const bal = Number(inv.total) - Number(inv.amount_paid ?? 0);
                  return (
                    <tr key={inv.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                      <td className="td font-medium">
                        <Link href={`/invoices/${inv.id}`} className="hover:text-copper">{inv.number}</Link>
                      </td>
                      <td className="td">
                        <span className="block">{inv.client_name}</span>
                        {inv.client_company && (
                          <span className="block text-xs text-muted">{inv.client_company}</span>
                        )}
                      </td>
                      <td className="td text-muted">{inv.issued_on ?? "—"}</td>
                      <td className="td text-muted">{inv.due_date ?? "—"}</td>
                      <td className="td text-right font-medium tabular-nums">
                        {money(Number(inv.total), inv.currency)}
                        {inv.status === "partially_paid" && (
                          <span className="block text-xs font-normal text-amber-700">
                            {money(bal, inv.currency)} due
                          </span>
                        )}
                      </td>
                      <td className="td">
                        <span className={cx("chip", badge.cls)}>{badge.label}</span>
                      </td>
                      <td className="td text-right">
                        <InvoiceRowActions id={inv.id} number={inv.number} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
