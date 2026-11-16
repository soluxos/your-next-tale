import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { syncReleases } from "@/lib/releases/syncReleases";

export const maxDuration = 300;

/**
 * Refreshes New & upcoming from Waterstones' and Bookshop.org's new and
 * coming-soon lists (see lib/releases/syncReleases).
 *
 * Call it as a signed-in admin (POST from the browser), or from a scheduler
 * with `Authorization: Bearer $CRON_SECRET` (GET or POST) once CRON_SECRET is
 * set. Weekly is plenty: the shops change their picks every week or two.
 */
async function handle(request) {
  const secret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization");
  const fromScheduler = !!secret && bearer === `Bearer ${secret}`;

  if (!fromScheduler) {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in first" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
  }

  const log = [];
  try {
    const dryRun = new URL(request.url).searchParams.get("dry") === "1";
    const result = await syncReleases(createAdminClient(), { log: (line) => log.push(line), dryRun });
    if (!dryRun) revalidatePath("/releases");
    return Response.json({ ok: true, ...result, log });
  } catch (e) {
    console.error("Releases sync failed:", e);
    return Response.json({ ok: false, error: e.message, log }, { status: 500 });
  }
}

export const POST = handle;
export const GET = (request) =>
  process.env.CRON_SECRET ? handle(request) : Response.json({ error: "Use POST" }, { status: 405 });
