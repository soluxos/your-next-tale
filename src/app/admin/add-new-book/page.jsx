import AddBookForm from "./add-book-form"
import { createClient } from "@/utils/supabase/server"

export default async function AddNewBook() {
  const supabase = await createClient()

  return (
    <div>
      <AddBookForm />
    </div>
  )
}
