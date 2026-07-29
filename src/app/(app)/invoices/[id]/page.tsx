import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDetailClient } from "./InvoiceDetailClient";
import type { CompanySettings } from "@/lib/types";

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

  return (
    <InvoiceDetailClient
      invoice={invoice}
      company={(company ?? null) as CompanySettings | null}
      autoPrint={sp.print === "1"}
    />
  );
}
