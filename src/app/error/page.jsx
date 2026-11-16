import Link from "next/link";
import StatusPage from "@/components/status/StatusPage";

export const metadata = { title: "That link didn’t work | Your Next Tale" };

// Landing page for failed email links (/auth/confirm redirects here).
export default function ErrorPage() {
  return (
    <StatusPage
      eyebrow="Email link · Expired or already used"
      title="That link didn’t work"
      actions={
        <>
          <Link href="/login" className="btn btn-primary">
            Sign in
          </Link>
          <Link href="/login/forgot" className="btn btn-secondary">
            Reset password
          </Link>
        </>
      }
    >
      Email links only work once and expire after a while. If you&rsquo;ve already confirmed your
      account, just sign in — or ask for a fresh password-reset link.
    </StatusPage>
  );
}
