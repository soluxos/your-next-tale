import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request) {
  const supabase = await createClient()

  // Get query parameters
  const { searchParams } = new URL(request.url)
  const start = parseInt(searchParams.get("start")) || 0
  const end = parseInt(searchParams.get("end")) || 20

  // Fetch books from Supabase in descending order (newest first)
  let { data: Books, error } = await supabase
    .from("Books")
    .select("*")
    .order("created_at", { ascending: false }) // Change "created_at" to the appropriate column
    .range(start, end)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ Books })
}
