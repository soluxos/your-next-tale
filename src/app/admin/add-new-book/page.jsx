import AddBookForm from "./add-book-form";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AddNewBook() {
  const supabase = await createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
    return null;
  }

  return <AddBookForm />;
}
