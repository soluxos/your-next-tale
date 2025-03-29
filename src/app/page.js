import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function PrivatePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  let { data: Books, error: booksError } = await supabase.from("Books").select("*")

  console.log("Books", Books)
  console.log("booksError", booksError)

  return (
    <div>
      <p>Hello {data.user ? data.user.email : ""}</p>
      <div>
        {Books && Books.length > 0 ? (
          <ul>
            {Books.map((book) => (
              <li key={book.id}>
                <h3>{book.title}</h3>
                <p>{book.author}</p>
                <p>{book.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No books available</p>
        )}
      </div>
    </div>
  )
}
