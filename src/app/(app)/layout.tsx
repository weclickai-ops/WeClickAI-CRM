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
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile as Profile} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-7 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
