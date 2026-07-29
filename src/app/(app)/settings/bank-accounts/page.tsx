import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { BankAccountsClient } from "./BankAccountsClient";
import type { BankAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BankAccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data } = await supabase.from("bank_accounts").select("*").order("created_at");

  return (
    <>
      <PageHeader
        title="Bank accounts"
        subtitle="Accounts you can bill into. Pick one per invoice; the default is used unless you change it."
      />
      <BankAccountsClient accounts={(data ?? []) as BankAccount[]} />
    </>
  );
}
