"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setNotice("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* left — brand panel */}
      <div className="relative hidden flex-col justify-between p-12 lg:flex"
           style={{ background: "var(--charcoal)" }}>
        <Logo light />
        <div className="max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight text-white">
            Find businesses that <span className="text-copper">don&apos;t have a website</span> yet.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Run a niche campaign anywhere in the world by postal code. WeClick AI CRM
            surfaces the leads, tracks the pipeline, and gets you to &quot;paid&quot;.
          </p>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} WeClick AI</p>
      </div>

      {/* right — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="font-display text-2xl font-semibold">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === "signin"
              ? "Welcome back — pick up where you left off."
              : "The first account becomes the admin."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <label className="label">Full name</label>
                <input className="input" value={fullName}
                       onChange={(e) => setFullName(e.target.value)} placeholder="Teja" required />
              </div>
            )}
            <div>
              <label className="label">Work email</label>
              <input className="input" type="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@weclick.ai" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password}
                     onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              className="font-medium text-copper hover:underline"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
