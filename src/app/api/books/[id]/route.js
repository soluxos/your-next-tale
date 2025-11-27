import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch a single book by ID
  const { data: book, error } = await supabase
    .from("Books")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  const response = NextResponse.json({ book });
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );
  return response;
}
