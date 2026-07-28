import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active, full_name, email, created_at")
    .eq("id", user.id)
    .maybeSingle();

  // Approved while this tab sat open — send them straight through.
  if (profile?.active) redirect("/dashboard");

  const brokenSignup = reason === "no-profile";

  return (
    <div className="grid min-h-screen place-items-center px-6" style={{ background: "var(--charcoal)" }}>
      <div className="w-full max-w-md rounded-xl2 bg-white p-8">
        <Logo />

        <h1 className="mt-6 font-display text-2xl font-semibold">
          {brokenSignup ? "Your account needs setting up" : "Waiting for approval"}
        </h1>

        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {brokenSignup ? (
            <>
              Your sign-in worked, but there&apos;s no team record attached to it yet.
              An admin needs to finish adding you before you can get in.
            </>
          ) : (
            <>
              You&apos;re signed in as <span className="text-ink">{user.email}</span>.
              An admin has to approve your access before you can see the CRM. You&apos;ll
              be in as soon as they do — no need to sign up again.
            </>
          )}
        </p>

        <p className="mt-6 rounded-lg bg-black/[0.03] px-4 py-3 text-sm text-muted">
          Need this sorted quickly? Message the person who asked you to join.
        </p>

        <div className="mt-6 flex items-center justify-between">
          <SignOutButton />
          <a href="/pending" className="text-sm font-medium text-copper hover:underline">
            Check again
          </a>
        </div>
      </div>
    </div>
  );
}
