import AddBookForm from "./add-book-form"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default async function AddNewBook() {
  const supabase = await createClient()
  const {
    data: { session }
  } = await supabase.auth.getSession()

  // Redirect to login if no session exists
  if (!session) {
    redirect("/login") // Replace "/login" with the path to your login page
    return null
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="navigation w-full p-5 flex items-center justify-between border-b-[1px] border-solid border-gray-300 bg-[#E7E7E7]">
          <a href="/admin/books" className="text-primary font-departureMono uppercase text-[14px]">
            Your Next Tale
            <sup className="text-[12px] align-super ml-1 text-[#0D00FF]">Admin</sup>
          </a>
        </div>
        <AddBookForm />
      </div>
    </>
  )
}
