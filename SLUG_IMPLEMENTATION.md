# Book URL Slugs - Implementation Guide

## Overview

Book pages now use SEO-friendly slugs instead of numeric IDs. URLs are generated from the book title and author name, making them more readable and better for SEO.

## URL Format

### Before

```
https://yournexttale.com/books/123
```

### After

```
https://yournexttale.com/books/the-great-gatsby-f-scott-fitzgerald
```

## How It Works

### 1. Slug Generation (`/src/lib/slugify.js`)

The `generateBookSlug()` function creates URL-safe slugs:

```javascript
generateBookSlug("The Great Gatsby", "F. Scott Fitzgerald");
// Returns: "the-great-gatsby-f-scott-fitzgerald"
```

**Slug Creation Rules:**

1. Combines title and author with a space
2. Converts to lowercase
3. Removes special characters (keeps letters, numbers, hyphens)
4. Replaces spaces with hyphens
5. Removes duplicate hyphens
6. Trims whitespace

**Examples:**

- "1984" by "George Orwell" → `1984-george-orwell`
- "Harry Potter & the Sorcerer's Stone" by "J.K. Rowling" → `harry-potter-the-sorcerers-stone-jk-rowling`
- "The Lord of the Rings: The Fellowship" by "J.R.R. Tolkien" → `the-lord-of-the-rings-the-fellowship-jrr-tolkien`

### 2. Book Lookup (`getBookFromSlug()`)

This function retrieves a book from the database by matching its slug:

```javascript
const book = await getBookFromSlug(
  "the-great-gatsby-f-scott-fitzgerald",
  supabase
);
```

**Process:**

1. Fetches all books from database
2. Generates slug for each book
3. Finds the book where slug matches the URL slug
4. Returns the matching book or null

### 3. Static Generation

The page uses Next.js static generation to create pages for all books at build time:

```javascript
export async function generateStaticParams() {
  const supabase = createStaticClient();
  const { data: books } = await supabase
    .from("Books")
    .select("id, title, author");

  return books.map((book) => ({
    slug: generateBookSlug(book.title, book.author)
  }));
}
```

## File Structure

```
src/
├── app/
│   └── books/
│       └── [slug]/              # Dynamic route using slug
│           ├── page.jsx         # Main book page
│           └── not-found.jsx    # 404 page
├── lib/
│   └── slugify.js               # Slug generation utilities
└── components/
    └── book/
        └── BookDrawer.jsx       # Updated to use slugs
```

## Implementation Details

### Book Page (`/src/app/books/[slug]/page.jsx`)

**Key Features:**

- Uses `[slug]` dynamic route parameter
- Static generation with ISR (revalidates hourly)
- SEO metadata generation
- 404 handling for invalid slugs

### Share Functionality

When users click "Share Book" in the drawer:

1. Generates slug from book title and author
2. Creates full URL: `https://yournexttale.com/books/{slug}`
3. Copies to clipboard

### Sitemap Generation

The sitemap includes all book URLs with proper slugs:

```javascript
{
  url: 'https://yournexttale.com/books/the-great-gatsby-f-scott-fitzgerald',
  lastModified: '2025-01-15',
  changeFrequency: 'monthly',
  priority: 0.8
}
```

## SEO Benefits

### 1. **Descriptive URLs**

- Users can see what the page is about from the URL
- Better click-through rates in search results

### 2. **Keyword Rich**

- Book title and author in URL
- Improves relevance for search queries

### 3. **Shareable**

- URLs are more memorable
- Professional appearance on social media

### 4. **Search Engine Friendly**

- Clear content hierarchy
- Hyphens are recognized as word separators

## Performance Considerations

### Build Time

- Slug generation happens once at build time
- All slugs are pre-computed
- No runtime performance impact

### Lookup Performance

- Current implementation: O(n) - iterates through all books
- Acceptable for small to medium catalogs (< 10,000 books)
- For larger catalogs, consider adding a `slug` column to database

## Future Optimizations

### Option 1: Database Column (Recommended for > 5000 books)

Add a `slug` column to the Books table:

```sql
ALTER TABLE "Books" ADD COLUMN "slug" TEXT;

-- Create index for fast lookups
CREATE INDEX idx_books_slug ON "Books"(slug);

-- Populate existing slugs
UPDATE "Books"
SET slug = lower(regexp_replace(
  title || ' ' || author,
  '[^a-zA-Z0-9\s-]', '', 'g'
));
```

Then update `getBookFromSlug()`:

```javascript
export async function getBookFromSlug(slug, supabase) {
  const { data: book } = await supabase
    .from("Books")
    .select("*")
    .eq("slug", slug)
    .single();

  return book;
}
```

### Option 2: In-Memory Cache

For medium-sized catalogs, cache slug-to-ID mappings:

```javascript
// At build time, create a lookup map
const slugMap = books.reduce((acc, book) => {
  acc[generateBookSlug(book.title, book.author)] = book.id;
  return acc;
}, {});
```

## Handling Edge Cases

### Duplicate Slugs

If two books generate the same slug (rare but possible):

**Current:** First match is returned
**Solution:** Append book ID to ensure uniqueness

```javascript
export function generateBookSlug(title, author, id) {
  const baseSlug = `${title} ${author}`
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // Optionally append ID for guaranteed uniqueness
  return id ? `${baseSlug}-${id}` : baseSlug;
}
```

### Special Characters

Books with titles in non-Latin scripts:

**Current:** Removes non-ASCII characters
**Enhancement:** Use transliteration library

```javascript
import slugify from "slugify";

export function generateBookSlug(title, author) {
  return slugify(`${title} ${author}`, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
}
```

## Testing

### Manual Testing URLs

Test these URL patterns work correctly:

1. **Standard book:**
   `/books/the-great-gatsby-f-scott-fitzgerald`

2. **Book with numbers:**
   `/books/1984-george-orwell`

3. **Book with special characters:**
   `/books/harry-potter-the-sorcerers-stone-jk-rowling`

4. **Non-existent slug:**
   `/books/fake-book-fake-author` → Should show 404

### Build Test

```bash
npm run build
```

Check output for generated routes:

```
Route (app)                              Size
├ ● /books/[slug]                        142 kB
│   ├ /books/the-great-gatsby-f-scott-fitzgerald
│   ├ /books/1984-george-orwell
│   └ [+X more paths]
```

## Migration from ID-based URLs

If you had existing ID-based URLs in production:

### Option 1: Add Redirects

In `next.config.mjs`:

```javascript
async redirects() {
  return [
    {
      source: '/books/:id(\\d+)',
      destination: '/books/:slug',
      permanent: true,
    },
  ];
}
```

### Option 2: Support Both Formats

Keep the `[id]` route and add `[slug]` route simultaneously, then gradually migrate.

## Troubleshooting

### "Book Not Found" on valid URLs

**Check:**

1. Slug generation matches between build and runtime
2. Book exists in database
3. Title/author haven't changed since build

**Fix:** Rebuild the site to regenerate slugs

### Build fails with slug errors

**Check:**

1. All books have both `title` and `author` fields
2. No null values in title or author
3. Database is accessible during build

### Slugs don't update after book edits

**Expected:** ISR revalidates every hour
**Force update:** Redeploy or clear cache

## Summary

✅ SEO-friendly URLs with book title and author
✅ Automatic slug generation at build time
✅ Static generation for all book pages
✅ Share functionality uses new slug format
✅ Sitemap includes all slug-based URLs
✅ No performance impact on page loads
