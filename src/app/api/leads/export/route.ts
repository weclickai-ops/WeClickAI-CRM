import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildCsv, fetchLeadsForExport, describeSelection, type LeadFilters,
} from "@/lib/leads/export";

export const runtime = "nodejs";
export const maxDuration = 60;

/** A CSV of 100k leads is about 20 MB — past that, filter it down first. */
const ROW_CAP = 100_000;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // The caller's own session, not the service role, so RLS decides what they
  // are allowed to export.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to export leads." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles").select("active").eq("id", user.id).maybeSingle();
  if (!profile?.active) {
    return NextResponse.json({ error: "Your account isn't approved yet." }, { status: 403 });
  }

  let body: { ids?: string[]; filters?: LeadFilters };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  try {
    // One extra row so "exactly at the cap" is distinguishable from "truncated".
    const leads = await fetchLeadsForExport(supabase, {
      ids: body.ids,
      filters: body.filters,
      limit: ROW_CAP + 1,
    });

    const truncated = leads.length > ROW_CAP;
    const rows = truncated ? leads.slice(0, ROW_CAP) : leads;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Nothing matches that, so there's nothing to export." },
        { status: 422 }
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(buildCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="weclick-leads-${stamp}.csv"`,
        "X-Row-Count": String(rows.length),
        "X-Truncated": String(truncated),
        "X-Selection": encodeURIComponent(describeSelection(body.ids, body.filters)),
      },
    });
  } catch (err) {
    console.error("[leads/export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The export failed." },
      { status: 500 }
    );
  }
}
