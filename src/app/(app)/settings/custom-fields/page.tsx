import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "../../PageHeader";
import { CustomFieldsClient } from "./CustomFieldsClient";

export const dynamic = "force-dynamic";

export default async function CustomFieldsPage() {
  const supabase = await createClient();
  const { data: fields } = await supabase.from("custom_fields")
    .select("*").eq("entity", "lead").order("position");
  return (
    <>
      <PageHeader title="Custom fields" subtitle="Add your own fields to every lead. They show up on the lead page." />
      <CustomFieldsClient initial={fields ?? []} />
    </>
  );
}
