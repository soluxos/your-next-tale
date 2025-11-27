# Book Page Generation

This document explains the dynamic book page generation system for Your Next Tale.

## Features

### 1. Individual Book Pages

Each book now has its own dedicated page at `/books/[id]` where users can:

- View the full book cover
- Read the complete description
- See author information
- Purchase via Amazon affiliate link
- Share the book URL

### 2. Static Site Generation (SSG)

The book pages use Next.js's `generateStaticParams` to pre-generate all book pages at build time for:

- **Better SEO**: Search engines can crawl and index individual book pages
- **Faster loading**: Pages are pre-rendered and served instantly
- **Better performance**: No database queries on page load

### 3. SEO Optimization

Each book page includes:

- Dynamic meta titles: `{title} by {author} | Your Next Tale`
- Open Graph metadata for social sharing
- Proper descriptions for search engines
- Sitemap generation for all book pages

### 4. Share Functionality

The BookDrawer now includes a "Share Book" button that:

- Copies the book's unique URL to clipboard
- Shows a "Link Copied!" confirmation
- Makes it easy for users to share specific books

## Files Created

### `/src/app/books/[id]/page.jsx`

The main dynamic route that:

- Generates static params for all books
- Creates SEO metadata for each book
- Fetches the book data server-side
- Renders the BookDetailPage component

### `/src/app/books/[id]/not-found.jsx`

A custom 404 page shown when a book ID doesn't exist.

### `/src/components/pages/book/BookDetailPage.jsx`

The client component that displays:

- Book cover with loading state
- Title and author
- Full description
- Amazon affiliate link
- Back to library navigation

### `/src/app/api/books/[id]/route.js`

API endpoint to fetch individual books by ID (optional, mainly for client-side fetching).

### `/src/app/sitemap.js`

Generates a sitemap including:

- Homepage
- All individual book pages
- Proper change frequencies and priorities

## How to Use

### Sharing Books

Users can now share specific books by:

1. Opening a book (clicking on it)
2. Clicking the "Share Book" button in the drawer
3. The URL is copied to clipboard automatically

### Direct Links

You can link to any book using:

```
https://yournexttale.com/books/{book_id}
```

### Building the Site

When you deploy or build your site:

```bash
npm run build
```

Next.js will automatically:

1. Fetch all books from Supabase
2. Generate a static page for each book
3. Create a sitemap with all URLs

### Adding New Books

When you add new books to your database:

1. They'll appear on the homepage immediately (client-side fetch)
2. For the static pages to be generated, rebuild and redeploy

## URL Structure

- Homepage: `/`
- All books grid: `/` (same as homepage)
- Individual book: `/books/{id}`

## Notes

- Update the domain in `sitemap.js` from `yournexttale.com` to your actual domain
- The share button uses the browser's Clipboard API
- Book pages are fully responsive and match your existing design system
- The pages use the new `ppMondwest` font you just added!
