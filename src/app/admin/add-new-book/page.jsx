import AddBookForm from "./add-book-form";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AddNewBook() {
  const supabase = await createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  // Redirect to login if no session exists
  if (!session) {
    redirect("/login"); // Replace "/login" with the path to your login page
    return null;
  }

  return (
    <>
      <div className="flex flex-col min-h-full flex-grow">
        <AddBookForm />
      </div>
    </>
  );
}
