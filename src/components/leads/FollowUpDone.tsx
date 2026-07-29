"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Loader2 } from "lucide-react";

/**
 * Marks one follow-up as done straight from the list. Calls the same
 * log_followup RPC the lead page uses, so the touch is recorded and the next
 * date rolls forward by the lead's own interval — no drift between the two.
 */
export function FollowUpDone({ leadId }: { leadId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function done() {
    setBusy(true);
    setFailed(false);
    const { error } = await supabase.rpc("log_followup", { p_lead: leadId, p_note: null });
    setBusy(false);
    if (error) {
      setFailed(true);
      return;
    }
    router.refresh();
  }

  return (
    <button
      className={`btn-outline px-2.5 py-1.5 ${failed ? "border-red-300 text-red-600" : ""}`}
      onClick={done}
      disabled={busy}
      title={failed ? "Couldn't save — try again" : "Followed up (rolls the date forward)"}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
    </button>
  );
}
