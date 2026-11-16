import StatusPage from "@/components/status/StatusPage";
import { HomeAction, SearchBooksAction } from "@/components/status/StatusActions";

export default function BookNotFound() {
  return (
    <StatusPage
      eyebrow="404 · Book not found"
      title="This book isn’t on our shelves"
      actions={
        <>
          <SearchBooksAction />
          <HomeAction />
        </>
      }
    >
      The link may be out of date, or the book may have been merged with another edition. Try
      searching for it by title or author.
    </StatusPage>
  );
}
