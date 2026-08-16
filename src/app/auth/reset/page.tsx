"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Loader2, Check, ShieldAlert } from "lucide-react";

/**
 * Reached from the reset email, via /auth/callback. By the time this renders
 * the recovery link has already been exchanged for a session, so setting a
 * new password is a plain updateUser call.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setValid(Boolean(data.user));
      setChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("Those two don't match."); return; }

    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message); return; }

    setDone(true);
    setTimeout(() => { router.push("/overview"); router.refresh(); }, 1200);
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Logo /></div>

        {checking ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your link…
          </p>
        ) : !valid ? (
          <>
            <ShieldAlert className="h-7 w-7 text-amber-600" />
            <h2 className="mt-3 font-display text-2xl font-semibold">This link has expired</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Reset links are single use and last an hour. Request a fresh one
              and it&rsquo;ll work.
            </p>
            <Link href="/login" className="btn-primary mt-6 w-full justify-center">
              Back to sign in
            </Link>
          </>
        ) : done ? (
          <>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100">
              <Check className="h-5 w-5 text-emerald-700" />
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">Password changed</h2>
            <p className="mt-1 text-sm text-muted">Taking you through…</p>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold">Choose a new password</h2>
            <p className="mt-1 text-sm text-muted">
              Eight characters or more. You&rsquo;ll be signed in straight after.
            </p>

            <form onSubmit={save} className="mt-6 space-y-4">
              <div>
                <label className="label">New password</label>
                <input className="input" type="password" value={password} autoFocus
                       onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <div>
                <label className="label">Type it again</label>
                <input className="input" type="password" value={confirm}
                       onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
