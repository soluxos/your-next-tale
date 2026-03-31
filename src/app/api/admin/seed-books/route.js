import { createClient } from "@/utils/supabase/server";
import { SEED_GENRES, runSeeder } from "@/lib/books/seeder";

export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const genresParam = url.searchParams.get("genres");
  const genres = genresParam
    ? SEED_GENRES.filter((g) =>
        genresParam
          .split(",")
          .map((l) => l.trim())
          .includes(g.label)
      )
    : SEED_GENRES;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      };

      try {
        await runSeeder({ genres, send, supabase });
      } catch (e) {
        send({ type: "error", message: e.message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
