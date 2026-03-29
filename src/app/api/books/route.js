import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request) {
  const supabase = await createClient()

  // Get query parameters
  const { searchParams } = new URL(request.url)
  const start = parseInt(searchParams.get("start")) || 0
  const end = parseInt(searchParams.get("end")) || 20

  // Fetch books from Supabase in descending order (newest first)
  let { data: books, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false })
    .range(start, end)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response = NextResponse.json({ books })
  response.headers.set("Cache-Control", "no-store") // Disable caching
  return response
}
