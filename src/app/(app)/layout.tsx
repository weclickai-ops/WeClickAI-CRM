import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import type { Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // No profile row at all — the signup trigger didn't fire. Sending them to
  // /login would loop, because they do have a valid session.
  if (!profile) redirect("/pending?reason=no-profile");

  // Signed up but not approved yet, or access was revoked.
  if (!profile.active) redirect("/pending");

  return (
    // On phones the whole page scrolls, so the top bar can stick and the
    // browser chrome hides as you scroll. On desktop only the main column
    // scrolls, keeping the sidebar fixed — the behaviour you already had.
    <div className="lg:flex lg:h-screen lg:overflow-hidden">
      <Sidebar profile={profile as Profile} />
      <main className="flex-1 lg:overflow-y-auto">
        <div
          className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
