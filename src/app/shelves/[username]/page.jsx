import { redirect } from "next/navigation";

// Legacy URL — public shelves now live at /u/[username].
export default async function LegacyPublicShelves({ params }) {
  const { username } = await params;
  redirect(`/u/${encodeURIComponent(username)}`);
}
