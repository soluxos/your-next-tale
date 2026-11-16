import Link from "next/link";
import HeroNew from "@/components/hero/HeroNew";
import ReleasesTeaser from "@/components/hero/ReleasesTeaser";
import BookRow from "@/components/home/BookRow";
import MostLoved from "@/components/home/MostLoved";
import DataCredit from "@/components/ui/DataCredit";
import { SFF_GENRES } from "@/lib/genres";

const GAP = "mt-20 sm:mt-28";

/**
 * Home: your own reading first, then a few short rows of what's worth
 * picking up. The whole catalogue lives on Discover.
 */
export default function HomePage({ lists = {}, total = null }) {
  return (
    <>
      <HeroNew />

      <BookRow
        id="trending"
        className={GAP}
        title="Trending now"
        description="What readers are picking up at the moment"
        href="/discover"
        linkLabel="Browse all"
        books={lists.trending}
      />

      <ReleasesTeaser />

      <BookRow
        id="new-noteworthy"
        className={GAP}
        title="New and noteworthy"
        description="Out in the last year or so, and already on a lot of shelves"
        href="/discover?sort=newest"
        linkLabel="All new books"
        books={lists.new}
      />

      <MostLoved
        className={GAP}
        genres={SFF_GENRES.map((g) => ({ slug: g.slug, label: g.label, books: lists[g.slug] }))}
      />

      <section aria-labelledby="browse-all" className={`${GAP} border-t border-line`}>
        <div className="page-x mx-auto max-w-[1600px] py-16 sm:py-24 flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label text-textSecondary">Discover</p>
            <h2
              id="browse-all"
              className="mt-4 max-w-[18ch] font-ppMondwest text-ink text-[34px] sm:text-[46px] leading-[1.02] tracking-[-0.01em]"
            >
              {total ? `${total.toLocaleString("en-GB")} books on the shelves, and counting` : "There’s a whole bookcase to browse"}
            </h2>
            <DataCredit className="mt-5 max-w-[46ch]" />
          </div>
          <Link href="/discover" className="btn btn-primary btn-lg">
            Browse the catalogue
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
