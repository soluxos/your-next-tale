"use client";

import { useState } from "react";
import SectionHeading, { SectionLink } from "@/components/hero/SectionHeading";
import Segmented from "@/components/ui/Segmented";
import { CoverRow, useRowBooks } from "@/components/home/BookRow";
import { cn } from "@/lib/utils";

/** Home: the all-time favourites, one genre at a time. */
export default function MostLoved({ genres, className }) {
  const filled = genres.filter((g) => g.books?.length);
  const [slug, setSlug] = useState(filled[0]?.slug);
  const current = filled.find((g) => g.slug === slug) || filled[0];
  const shown = useRowBooks(current?.books);
  if (!current) return null;

  return (
    <section aria-labelledby="most-loved" className={cn("page-x mx-auto max-w-[1600px]", className)}>
      <SectionHeading
        id="most-loved"
        title="Most loved"
        description="The books readers keep on their shelves and press on their friends"
        action={
          <>
            {filled.length > 1 && (
              <Segmented
                label="Genre"
                value={current.slug}
                onChange={setSlug}
                options={filled.map((g) => ({ value: g.slug, label: g.label }))}
                className="max-sm:flex-1 max-sm:flex"
              />
            )}
            <SectionLink href={`/discover?genre=${current.slug}`} className="max-sm:hidden sm:ml-4">
              See more
            </SectionLink>
          </>
        }
      />
      {shown.length ? (
        <CoverRow books={shown} />
      ) : (
        <p className="card px-5 py-4 font-ppMondwest text-[17px] text-textSecondary">
          You’ve shelved every one of these. There are plenty more in Discover.
        </p>
      )}
    </section>
  );
}
