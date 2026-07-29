import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { CompanyClient } from "./CompanyClient";
import type { CompanySettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();

  if (!data) {
    return (
      <>
        <PageHeader title="Company profile" />
        <div className="card p-8 text-center">
          <p className="font-medium">No company profile row yet</p>
          <p className="mt-1 text-sm text-muted">
            Run company-profile.sql in the Supabase SQL editor — it creates the
            single row this page edits.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Company profile"
        subtitle="Address, contacts, terms and signature — everything that prints on an invoice."
      />
      <CompanyClient settings={data as CompanySettings} />
    </>
  );
}
