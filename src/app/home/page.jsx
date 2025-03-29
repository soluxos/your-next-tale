import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import Book from "@/components/book/book"

export default async function PrivatePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  let { data: Books, error } = await supabase.from("Books").select("*").range(0, 0)

  if (error || !data?.user) {
    redirect("/login")
  }

  console.log("Books", Books)

  return (
    <div className="w-full p-6">
      {Books && Books.length > 0 ? (
        <ul className="flex flex-wrap items-end gap-6">
          {Books.map((book) => (
            <li key={book.id}>
              <Book {...book} />
            </li>
          ))}
        </ul>
      ) : (
        <p>No books available</p>
      )}
      {/* <button onClick= {() => redirect("/logout")}>Logout</button> */}
    </div>
  )
}
