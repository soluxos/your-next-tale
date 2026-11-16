import DiscoverPage from "@/components/pages/discover/DiscoverPage";
import { PAGE_SIZE, SORTS, countCatalogue, listCatalogue } from "@/lib/books/catalogueRanks";
import { SFF, SFF_GENRES } from "@/lib/genres";
import { createStaticClient } from "@/utils/supabase/static";

export const metadata = {
  title: "Discover fantasy and sci-fi | Your Next Tale",
  description:
    "Browse fantasy and science fiction, from the books everyone is reading to the ones just out, and add them to your shelves."
};

/** The catalogue: fantasy and science fiction, most popular first. */
export default async function Discover({ searchParams }) {
  const params = await searchParams;
  const genre = SFF_GENRES.some((g) => g.slug === params?.genre) ? params.genre : null;
  const sort = SORTS.includes(params?.sort) ? params.sort : SORTS[0];

  const supabase = createStaticClient();
  const [first, total] = await Promise.all([
    listCatalogue(supabase, { genre: genre || SFF, sort, start: 0, end: PAGE_SIZE - 1 }).catch(() => null),
    countCatalogue(supabase, genre || SFF).catch(() => null)
  ]);

  return (
    <DiscoverPage
      initialGenre={genre}
      initialSort={sort}
      initialBooks={first?.books || []}
      initialHasMore={first ? first.hasMore : true}
      initialTotal={total}
    />
  );
}
