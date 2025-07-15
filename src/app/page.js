import React from "react"
import HomePage from "@/components/pages/home/HomePage"
import { createClient } from "@/utils/supabase/server"

export default async function BooksPage() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser() // Use getUser() for secure authentication

  return (
    <>
      <HomePage isLoggedIn={!!user} />
    </>
  )
}
