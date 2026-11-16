import ReleasesPage from "@/components/pages/releases/ReleasesPage";
import { RELEASE_GENRES, listable, releaseRank, releasesSnapshotUrl } from "@/lib/releases/genres";
import { createStaticClient } from "@/utils/supabase/static";

export const metadata = {
  title: "New & upcoming fantasy and sci-fi | Your Next Tale",
  description:
    "The fantasy and science fiction booksellers at Waterstones and Bookshop.org are most excited about, and the ones just out. Add them to your Want to Read shelf."
};

async function getSnapshot() {
  try {
    const res = await fetch(releasesSnapshotUrl(), { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Blurbs for the few books that can lead "Most anticipated", by book id. */
async function getLeadBlurbs(snapshot) {
  const today = new Date().toISOString().slice(0, 10);
  const ids = new Set();
  for (const list of Object.values(snapshot?.genres || {})) {
    list
      .filter((x) => listable(x) && x.bookId && x.releaseDate >= today)
      .sort((a, b) => releaseRank(b) - releaseRank(a))
      .slice(0, 3)
      .forEach((x) => ids.add(x.bookId));
  }
  if (!ids.size) return {};
  try {
    const { data } = await createStaticClient().from("books").select("id, description").in("id", [...ids]);
    return Object.fromEntries((data || []).filter((b) => b.description).map((b) => [b.id, b.description]));
  } catch {
    return {};
  }
}

export default async function Releases({ searchParams }) {
  const [snapshot, params] = await Promise.all([getSnapshot(), searchParams]);
  const blurbs = await getLeadBlurbs(snapshot);
  const genre = RELEASE_GENRES.some((g) => g.slug === params?.genre) ? params.genre : RELEASE_GENRES[0].slug;
  const when = params?.when === "out" ? "out" : "soon";
  return <ReleasesPage snapshot={snapshot} blurbs={blurbs} initialGenre={genre} initialWhen={when} />;
}
