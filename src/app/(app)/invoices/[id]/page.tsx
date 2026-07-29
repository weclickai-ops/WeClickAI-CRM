import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDetailClient } from "./InvoiceDetailClient";
import type { CompanySettings, BankAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: invoice }, { data: company }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (!invoice) notFound();

  // The account chosen when the invoice was raised. Older invoices have none,
  // so the document falls back to the bank details on company_settings.
  const { data: bank } = invoice.bank_account_id
    ? await supabase.from("bank_accounts").select("*").eq("id", invoice.bank_account_id).maybeSingle()
    : { data: null };

  return (
    <InvoiceDetailClient
      invoice={invoice}
      company={(company ?? null) as CompanySettings | null}
      bank={(bank ?? null) as BankAccount | null}
      autoPrint={sp.print === "1"}
    />
  );
}
