import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

// Creating a handler to a GET request to route /auth/confirm
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = "/account"

  // Create redirect link without the secret token
  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete("token_hash")
  redirectTo.searchParams.delete("type")

  if (token_hash && type) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash
    })

    if (!error && data.user) {
      // Ensure the profile row exists now that the user is confirmed.
      // full_name comes from the metadata stored during signUp.
      const fullName = data.user.user_metadata?.full_name || ""
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        updated_at: new Date().toISOString()
      })

      redirectTo.searchParams.delete("next")
      return NextResponse.redirect(redirectTo)
    }
  }

  // return the user to an error page with some instructions
  redirectTo.pathname = "/error"
  return NextResponse.redirect(redirectTo)
}
