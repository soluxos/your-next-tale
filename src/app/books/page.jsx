import { redirect } from "next/navigation";

// The catalogue lives on Discover. Keep /books working for old links and
// bookmarks.
export default function BooksIndex() {
  redirect("/discover");
}
