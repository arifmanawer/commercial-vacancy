import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * /dashboard redirects to the role-appropriate dashboard.
 * Middleware handles auth; this handles role-based routing.
 */
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_landlord, is_contractor")
    .eq("id", user.id)
    .single();

  if (profile?.is_landlord) redirect("/dashboard/landlord");
  if (profile?.is_contractor) redirect("/dashboard/contractor");
  redirect("/dashboard/renter");
}
