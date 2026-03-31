/**
 * Hardcover GraphQL API client.
 * Server-side only — HARDCOVER_API_TOKEN must never reach the browser.
 */

const HARDCOVER_ENDPOINT = "https://api.hardcover.app/v1/graphql";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function hardcoverQuery(query, variables = {}) {
  const token = process.env.HARDCOVER_API_TOKEN;
  if (!token) throw new Error("HARDCOVER_API_TOKEN is not set");

  const res = await fetch(HARDCOVER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) throw new Error(`Hardcover API error: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Hardcover GraphQL error: ${json.errors[0].message}`);
  }
  return json.data;
}

/**
 * Discover popular books by genre tag using the Hardcover books table directly.
 * Two-step approach:
 *   1. Look up the tag ID for the genre name.
 *   2. Query books filtered by that tag, sorted by users_read_count desc, paginated.
 *
 * This avoids the Typesense search endpoint (which only supports text-field searching,
 * not filtering by genre arrays) and uses Hasura's direct table access instead.
 */
export async function discoverPopularBooks({
  genreTag,
  targetCount = 50,
  minUsersReadCount = 50
} = {}) {
  // Step 1: Resolve tag name → tag ID (take highest-count match)
  const tagLookupQuery = `
    query GetTagId($tag: String!) {
      tags(
        where: { tag: { _eq: $tag } }
        order_by: { count: desc }
        limit: 1
      ) {
        id
        tag
        count
      }
    }
  `;

  const tagData = await hardcoverQuery(tagLookupQuery, { tag: genreTag });
  const matchingTags = tagData?.tags || [];

  if (!matchingTags.length) {
    throw new Error(`No Hardcover tag found for "${genreTag}"`);
  }

  const tagId = parseInt(matchingTags[0].id, 10);

  // Step 2: Paginate books tagged with this ID, sorted by readers
  const booksQuery = `
    query BooksByTag($tagId: Int!, $minReaders: Int!, $limit: Int!, $offset: Int!) {
      books(
        where: {
          taggings: { tag_id: { _eq: $tagId } }
          book_category_id: { _eq: 1 }
          book_status_id: { _eq: 1 }
          users_read_count: { _gte: $minReaders }
        }
        order_by: { users_read_count: desc }
        limit: $limit
        offset: $offset
      ) {
        id
        title
        users_read_count
        image { url }
        editions(
          where: {
            isbn_13: { _is_null: false }
            language_id: { _eq: 1 }
          }
          order_by: { users_count: desc }
          limit: 1
        ) {
          isbn_13
          isbn_10
        }
      }
    }
  `;

  const PER_PAGE = 50;
  const MAX_PAGES = 4; // up to 200 candidates per genre
  const seenIds = new Set();
  const books = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await hardcoverQuery(booksQuery, {
      tagId,
      minReaders: minUsersReadCount,
      limit: PER_PAGE,
      offset: page * PER_PAGE
    });

    const rawBooks = data?.books || [];
    if (!rawBooks.length) break;

    for (const book of rawBooks) {
      if (seenIds.has(book.id)) continue;
      seenIds.add(book.id);

      const edition = book.editions?.[0] || null;
      books.push({
        hardcover_id: book.id,
        title: book.title,
        author_names: [],
        users_read_count: book.users_read_count || 0,
        isbn_13: edition?.isbn_13 || null,
        isbn_10: edition?.isbn_10 || null,
        image_url: book.image?.url || null
      });
    }

    if (books.length >= targetCount) break;
    if (rawBooks.length < PER_PAGE) break;

    await sleep(300);
  }

  return books;
}

/**
 * Fetch full book details from Hardcover by book ID.
 * Returns description, cover, tags, editions with ISBNs, etc.
 */
export async function getBookDetails(hardcoverId) {
  const query = `
    query BookDetails($id: Int!) {
      books(where: { id: { _eq: $id } }, limit: 1) {
        id
        title
        description
        rating
        ratings_count
        users_read_count
        pages
        release_date
        slug
        cached_tags
        cached_contributors
        image {
          url
        }
        editions(
          where: {
            isbn_13: { _is_null: false }
            language_id: { _eq: 1 }
          }
          order_by: { users_count: desc }
          limit: 1
        ) {
          isbn_13
          isbn_10
          edition_format
          publisher { name }
          release_date
        }
      }
    }
  `;

  const data = await hardcoverQuery(query, { id: parseInt(hardcoverId, 10) });
  return data?.books?.[0] || null;
}

/**
 * Extract genre tags from Hardcover's cached_tags field.
 * cached_tags may be shaped as:
 *   { "Genre": ["fantasy", "sci-fi"] }          — array of strings
 *   { "Genre": [{ tag: "fantasy", count: 5 }] } — array of objects
 *   [{ tag: "fantasy", category: "Genre" }]      — flat array with category
 */
export function extractGenres(cachedTags) {
  if (!cachedTags) return [];

  let tags = [];

  if (Array.isArray(cachedTags)) {
    // Flat array format: [{ tag, category }, ...]
    tags = cachedTags
      .filter((t) => {
        const cat = t?.category || t?.tag_category || "";
        return cat.toLowerCase() === "genre" || !cat;
      })
      .map((t) => t?.tag || t?.name || t?.label || t);
  } else {
    // Object format: { "Genre": [...], "Mood": [...] }
    tags = cachedTags["Genre"] || cachedTags["genre"] || [];
  }

  return tags
    .slice(0, 8)
    .map((g) => {
      if (typeof g === "string") return g.toLowerCase().trim();
      if (g && typeof g === "object") {
        const name = g.tag || g.name || g.label || g.value;
        return typeof name === "string" ? name.toLowerCase().trim() : null;
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Extract author names from Hardcover's cached_contributors field.
 */
export function extractAuthors(cachedContributors) {
  if (!cachedContributors || !Array.isArray(cachedContributors)) return [];
  return cachedContributors
    .filter((c) => {
      const role = c?.role || c?.contribution || "";
      return !role || role.toLowerCase() === "author";
    })
    .map((c) => c?.author?.name || c?.name || c?.cached_name)
    .filter((n) => typeof n === "string" && n.trim());
}

/**
 * Search Hardcover for books matching a query.
 * Used in the user-facing book search endpoint.
 * Returns an array of result objects shaped for the search dedup pipeline.
 */
export async function searchHardcover(q) {
  try {
    const token = process.env.HARDCOVER_API_TOKEN;
    if (!token) return [];

    const query = `
      query Search($q: String!) {
        search(
          query: $q
          query_type: "Book"
          per_page: 10
          page: 1
          sort: "activities_count:desc"
        ) {
          results
        }
      }
    `;

    const res = await fetch(HARDCOVER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ query, variables: { q } })
    });

    if (!res.ok) return [];
    const json = await res.json();
    const raw = json.data?.search?.results;
    if (!raw) return [];

    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const hits = parsed?.hits || parsed || [];

    return hits.map((hit) => {
      const doc = hit.document || hit;
      const isbn13 = doc.isbns?.find((i) => i?.length === 13) || null;
      const isbn10 = doc.isbns?.find((i) => i?.length === 10) || null;
      return {
        source: "hardcover",
        is_incomplete: false,
        _raw: doc,
        preview: {
          title: doc.title,
          author: doc.author_names?.[0] || "",
          isbn_13: isbn13,
          isbn_10: isbn10,
          cover_preview_url: doc.image?.url || null,
          all_covers: doc.image?.url ? [doc.image.url] : [],
          users_read_count: doc.users_read_count || 0
        }
      };
    });
  } catch {
    return [];
  }
}
