import React from "react";
import HomePage from "@/components/pages/home/HomePage";
import { createStaticClient } from "@/utils/supabase/static";

export default async function BooksPage() {
  const supabase = createStaticClient();

  // Fetch initial books server-side (first 45 books)
  const { data: initialBooks, error } = await supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, 44); // Get first 45 books (0-44)

  // Get user authentication status (if using server client for auth)
  // For now, setting isLoggedIn to false since we're using static client
  const isLoggedIn = false;

  return (
    <>
      <HomePage isLoggedIn={isLoggedIn} initialBooks={initialBooks || []} />
    </>
  );
}
