import Link from "next/link";
import StatusPage from "@/components/status/StatusPage";
import { HomeAction } from "@/components/status/StatusActions";

export const metadata = { title: "Page not found | Your Next Tale" };

export default function NotFound() {
  return (
    <StatusPage
      eyebrow="404 · Page not found"
      title="We couldn’t find that page"
      actions={
        <>
          <HomeAction primary />
          <Link href="/discover" className="btn btn-secondary">
            Browse books
          </Link>
        </>
      }
    >
      The link may be mistyped or out of date, or the page may have moved.
    </StatusPage>
  );
}
