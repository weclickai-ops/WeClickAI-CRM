"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Eye, EyeOff, ArrowLeft, MailCheck } from "lucide-react";
import { GoogleButton } from "./GoogleButton";

/** useSearchParams needs a Suspense boundary; the wrapper below provides one. */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);

  // /auth/callback hands failures back here with a readable message.
  useEffect(() => {
    const e = params.get("error");
    if (e) setError(e);
  }, [params]);

  /** Emails a one-time link that lands on /auth/reset. */
  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setNotice(null);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/overview"); router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/pending`,
          },
        });
        if (error) throw error;

        // /pending creates the finance_users row. If the address is on the
        // auto-approve list it redirects straight through to /overview, so
        // approved people never see a waiting screen.
        if (data.session) {
          router.push("/pending"); router.refresh();
        } else {
          setNotice("Check your email for the confirmation link, then sign in.");
          setMode("signin");
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[320px]">
        <div className="mb-8 text-center">
          <span className="mb-3.5 inline-grid h-11 w-11 place-items-center rounded-xl font-display text-xl font-bold text-white"
                style={{ background: "var(--copper)" }}>W</span>
          <p className="font-display text-lg font-semibold tracking-tight">
            WeClick<span className="text-copper"> AI</span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted">Finance</p>
        </div>

        {mode !== "forgot" && (
          <>
            <GoogleButton
              label={mode === "signin" ? "Sign in with Google" : "Sign up with Google"}
              onError={setError}
            />
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] text-muted">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        {mode === "forgot" ? (
          sent ? (
            <div className="text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-100">
                <MailCheck className="h-5 w-5 text-emerald-700" />
              </div>
              <p className="mt-3 font-medium">Check your inbox</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                If an account exists for {email}, a reset link is on its way.
                It lasts an hour and works once.
              </p>
              <button className="btn-ghost mt-4 text-[13px] text-copper"
                      onClick={() => { setMode("signin"); setSent(false); }}>
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={sendReset} className="space-y-2.5">
              <input className="input" type="email" value={email} required autoFocus
                     placeholder="you@weclickai.com"
                     onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Email me a link
              </button>
              <button type="button" className="btn-ghost w-full text-[13px] text-muted"
                      onClick={() => { setMode("signin"); setError(null); }}>
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </button>
            </form>
          )
        ) : (
        <form onSubmit={submit} className="space-y-2.5">
          {mode === "signup" && (
            <input className="input" value={fullName} required placeholder="Full name"
                   onChange={(e) => setFullName(e.target.value)} />
          )}
          <input className="input" type="email" value={email} required placeholder="you@weclickai.com"
                 onChange={(e) => setEmail(e.target.value)} />
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? "text" : "password"}
              value={password}
              required
              minLength={6}
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted
                         transition-colors hover:text-ink focus:outline-none
                         focus-visible:ring-2 focus-visible:ring-copper"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{notice}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          {mode === "signin" && (
            <button type="button"
                    className="w-full pt-1 text-center text-[12px] text-muted hover:text-copper"
                    onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}>
              Forgot your password?
            </button>
          )}
        </form>
        )}

        {mode !== "forgot" && (
        <p className="mt-5 text-center text-[13px] text-muted">
          {mode === "signin" ? "No account?" : "Already have one?"}{" "}
          <button className="font-medium text-copper hover:underline"
                  onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}>
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
