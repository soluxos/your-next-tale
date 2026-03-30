import { createClient } from "@/utils/supabase/server";
import { SEED_SUBJECTS, runSeeder } from "@/lib/books/seeder";

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
  const subjectsParam = url.searchParams.get("subjects");
  const subjects = subjectsParam
    ? SEED_SUBJECTS.filter((s) =>
        subjectsParam
          .split(",")
          .map((l) => l.trim())
          .includes(s.label)
      )
    : SEED_SUBJECTS;

  // Also support custom subjects passed as JSON
  const customParam = url.searchParams.get("custom");
  if (customParam) {
    const customLabels = customParam
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    for (const label of customLabels) {
      if (!subjects.find((s) => s.label === label)) {
        subjects.push({
          subject: label.toLowerCase(),
          label,
          minEditions: 3
        });
      }
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      };

      try {
        await runSeeder({ subjects, send, supabase });
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
