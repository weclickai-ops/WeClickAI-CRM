import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { money } from "@/lib/utils";
import type { Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });

  const paid = (invoices ?? []).filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total), 0);
  const outstanding = (invoices ?? []).filter((i: any) => i.status === "sent").reduce((s: number, i: any) => s + Number(i.total), 0);

  return (
    <>
      <PageHeader title="Invoices" subtitle={`${money(paid)} collected · ${money(outstanding)} outstanding`}
        action={<Link href="/invoices/new" className="btn-primary">New invoice</Link>} />

      <div className="card overflow-hidden">
        {(invoices?.length ?? 0) === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted">
            No invoices yet. Create one from a lead, or start a blank one.
          </div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-line">
              <th className="th">Number</th><th className="th">Client</th>
              <th className="th">Total</th><th className="th">Due</th><th className="th">Status</th>
            </tr></thead>
            <tbody>
              {(invoices as Invoice[]).map((inv) => (
                <tr key={inv.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                  <td className="td font-medium">
                    <Link href={`/invoices/${inv.id}`} className="hover:text-copper">{inv.number}</Link>
                  </td>
                  <td className="td">{inv.client_name}</td>
                  <td className="td font-medium">{money(Number(inv.total), inv.currency)}</td>
                  <td className="td text-muted">{inv.due_date ?? "—"}</td>
                  <td className="td"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
